import { Point3d } from "shared/types/point.types.ts";
import { ProxyEvent, Direction } from "shared/enums/main.ts";
import { Languages } from "./languages.types.ts";

export type PrivateUser = {
  id: string;
  username: string;
  session?: string;
  clientId?: string;
  language?: Languages;
};

export type User = {
  id: string;
  username: string;

  roomId?: string;

  position?: Point3d;
  positionUpdatedAt?: number;

  bodyDirection?: Direction;
};

export type UsersConfig = {
  op: {
    users: string[];
  };
  whitelist: {
    active: boolean;
    users: string[];
  };
  blacklist: {
    active: boolean;
    users: string[];
  };
};

export type UserMutable = {
  getId: () => string;
  getUsername: () => string;

  setPosition: (position: Pick<Point3d, "x" | "z">) => void;
  getPosition: () => Point3d | null;
  getPositionUpdatedAt: () => number | null;

  setBodyDirection: (direction: Direction) => void;
  getBodyDirection: () => Direction;

  setRoom: (roomId: string) => void;
  getRoom: () => string | null;
  removeRoom: () => void;

  setPathfinding: (path: Point3d[]) => void;
  getPathfinding: () => Point3d[];

  setLastMessage: (message: string) => void;
  getLastMessage: () => string;

  getObject: () => User;

  getLanguage: () => Languages;

  disconnect: () => void;

  emit: <Data extends any>(event: ProxyEvent, data?: Data) => void;
};
