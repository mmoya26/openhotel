import {
  appendCORSHeaders,
  getRandomString,
  initLog,
  log,
  waitUntil,
} from "shared/utils/main.ts";
import { getChildWorker } from "worker_ionic";
import {
  ConfigTypes,
  Envs,
  PrivateUser,
  WorkerProps,
} from "shared/types/main.ts";
import { getServerSocket, ServerClient } from "socket_ionic";
import { PROXY_CLIENT_EVENT_WHITELIST } from "shared/consts/main.ts";
import { ProxyEvent } from "shared/enums/main.ts";
import { load as loadUpdater } from "modules/updater/main.ts";
import { routesList } from "./router/main.ts";

const serverWorker = getChildWorker();

// This maps client id to user id (1:1), to prevent the connection of the user multiple times
// The accountId cannot be duplicated as value, if so, it would be the same user connected twice
let clientIdAccountIdMap: Record<string, string> = {};
export let userList: PrivateUser[] = [];
export const ticketMap: Record<
  string,
  {
    ticketId: string;
    ticketKey: string;
  }
> = {};
export const protocolToken = getRandomString(64);
let userClientMap: Record<string, ServerClient> = {};

let server;
let $config: ConfigTypes;
let $envs: Envs;

type DataEvent = {
  users: string[];
  event: string;
  message: object;
};

serverWorker.on(
  ProxyEvent.$USER_DATA,
  ({ users, event, message }: DataEvent) => {
    try {
      // broadcast
      if (users.includes("*")) return server.emit(event, message);
      //
      for (const user of users.map((accountId) =>
        userList.find((user) => user.accountId === accountId),
      ))
        userClientMap?.[user?.clientId]?.emit?.(event, message);
    } catch (e) {
      console.error("proxy-1");
      console.error(e);
    }
  },
);

serverWorker.on(ProxyEvent.$ADD_ROOM, ({ roomId, accountId }) => {
  try {
    const user = userList.find((user) => user.accountId === accountId);
    if (!user) return;
    server?.getRoom?.(roomId)?.addClient?.(user?.clientId);
  } catch (e) {
    console.error("proxy-2");
    console.error(e);
  }
});

serverWorker.on(ProxyEvent.$REMOVE_ROOM, ({ roomId, accountId }) => {
  try {
    const user = userList.find((user) => user.accountId === accountId);
    if (!user) return;
    server?.getRoom?.(roomId)?.removeClient?.(user?.clientId);
  } catch (e) {
    console.error("proxy-3");
    console.error(e);
  }
});

serverWorker.on(ProxyEvent.$ROOM_DATA, ({ roomId, event, message }) => {
  try {
    server?.getRoom?.(roomId)?.emit?.(event, message);
  } catch (e) {
    console.error("proxy-4");
    console.error(e);
  }
});
serverWorker.on(ProxyEvent.$DISCONNECT_USER, ({ clientId }) => {
  try {
    userClientMap?.[clientId]?.close?.();
  } catch (e) {
    console.error("proxy-5");
    console.error(e);
  }
});
serverWorker.on(ProxyEvent.$UPDATE, async () => {
  const canUpdate = await loadUpdater({ config: $config, envs: $envs });

  if (canUpdate) serverWorker.emit(ProxyEvent.$STOP);
});

serverWorker.on("start", async ({ config, envs }: WorkerProps) => {
  $config = config;
  $envs = envs;
  initLog(envs);

  const isAuthDisabled = envs.isDevelopment;

  server = getServerSocket(config.proxy.port, async (request: Request) => {
    const { method, url } = request;
    const { pathname } = new URL(url);

    const foundRoute = routesList.find(
      (route) => route.method === method && route.pathname === pathname,
    );

    let response = new Response("404", { status: 404 });
    if (foundRoute) response = await foundRoute.fn(request, config, envs);
    appendCORSHeaders(response.headers);
    return response;
  });

  server.on(
    "guest",
    async (clientId: string, [$protocolToken, ticketId, sessionId, token]) => {
      let foundUser;
      if (isAuthDisabled) {
        const username = ticketId;
        const accountId = crypto.randomUUID();

        userList.push({
          clientId,
          accountId,
          username,
        });
        return true;
      }

      if (
        $protocolToken !== protocolToken &&
        userList.length >= config.limits.players
      )
        return false;

      const foundTicket = ticketMap[ticketId];
      //if not found
      if (!foundTicket) return false;

      const { status, data } = await fetch(`${config.auth.api}/claim-session`, {
        method: "POST",
        body: JSON.stringify({
          ticketId: foundTicket.ticketId,
          ticketKey: foundTicket.ticketKey,
          sessionId,
          token,
        }),
      }).then((data) => data.json());

      if (status !== 200) return false;

      foundUser = userList.find((user) => user.accountId === data.accountId);
      if (foundUser) {
        userClientMap[foundUser.clientId]?.close();
        foundUser.clientId = clientId;
        foundUser.username = data.username;
        return true;
      }
      userList.push({
        clientId,
        accountId: data.accountId,
        username: data.username,
      });
      return true;
    },
  );
  server.on("connected", async (client: ServerClient) => {
    try {
      const foundUser: PrivateUser | undefined = userList.find(
        (user) => user.clientId === client.id,
      );

      if (!foundUser) return client?.close();

      // Wait if current user is connected to be disconnected
      await waitUntil(
        () =>
          !Object.values(clientIdAccountIdMap).includes(foundUser.accountId),
      );
      // Assign the accountId to the clientId. accountId can only be once as value.
      clientIdAccountIdMap[client?.id] = foundUser.accountId;

      userClientMap[foundUser.clientId] = client;
      serverWorker.emit(ProxyEvent.$USER_JOINED, {
        data: { user: foundUser },
      });

      client.on(ProxyEvent.$USER_DATA, ({ event, message }) => {
        try {
          // Disconnect client if tries to send events outside the whitelist
          if (!PROXY_CLIENT_EVENT_WHITELIST.includes(event))
            return client?.close?.();
          serverWorker.emit(ProxyEvent.$USER_DATA, {
            user: foundUser,
            event,
            message,
          });
        } catch (e) {
          console.error("proxy-6");
          console.error(e);
        }
      });
      client.emit(ProxyEvent.WELCOME, {
        datetime: Date.now(),
        user: foundUser,
      });
    } catch (e) {
      console.error("proxy-7");
      console.error(e);
    }
  });
  server.on("disconnected", (client: ServerClient) => {
    try {
      if (!client?.id) return;

      const accountId = clientIdAccountIdMap[client.id];
      if (!accountId) return;

      const foundUser = userList.find((user) => user.accountId === accountId);

      if (!foundUser) return;

      delete userClientMap[client.id];
      delete clientIdAccountIdMap[client.id];

      userList = userList.filter((user) => user.clientId !== client.id);

      serverWorker.emit(ProxyEvent.$USER_LEFT, { data: { user: foundUser } });
    } catch (e) {
      console.error("proxy-8");
      console.error(e);
    }
  });
  log(`Proxy started on :${config.proxy.port}`);
});
