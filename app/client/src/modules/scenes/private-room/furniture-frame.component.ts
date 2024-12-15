import {
  ContainerComponent,
  Cursor,
  DisplayObjectEvent,
  EventMode,
  sprite,
} from "@tu/tulip";
import { FurnitureDirectionData, Point2d, Point3d } from "shared/types";
import { TILE_SIZE } from "shared/consts";
import { System } from "system";
import { CrossDirection, SystemEvent } from "shared/enums";
import { getPositionFromIsometricPosition } from "shared/utils";

type Props = {
  id: string;
  isometricPosition: Point3d;
  framePosition: Point2d;
  furniture: string;
  direction: CrossDirection;
};

type Mutable = {};

export const furnitureFrameComponent: ContainerComponent<Props, Mutable> = ({
  id,
  furniture,
  direction,
  isometricPosition,
  framePosition,
}) => {
  const furnitureData = System.game.furniture.get(furniture);

  const furnitureDirectionData = furnitureData.direction[
    direction
  ] as FurnitureDirectionData;

  const positionZIndex =
    isometricPosition.x + isometricPosition.z - isometricPosition.y;

  const { texture, bounds, zIndex, hitArea } =
    furnitureDirectionData.textures[0];

  const isNorthDirection = direction === CrossDirection.NORTH;

  const position = getPositionFromIsometricPosition(isometricPosition);
  const frameIsometricPosition = {
    x: isNorthDirection ? framePosition.x * 2 : -framePosition.x * 2,
    y: -framePosition.y * 2 + framePosition.x,
  };

  const $sprite = sprite({
    spriteSheet: furnitureData.spriteSheet,
    texture,
    position: {
      x: position.x + frameIsometricPosition.x,
      y: position.y + frameIsometricPosition.y,
    },
    zIndex: positionZIndex + zIndex - 0.2,
    pivot: {
      x: -TILE_SIZE.width / 2 + bounds.width / 2,
      y: bounds.height / 2,
    },
    eventMode: EventMode.STATIC,
    cursor: Cursor.POINTER,
    hitArea,
  });
  $sprite.on(DisplayObjectEvent.POINTER_TAP, (event: MouseEvent) => {
    if (event.shiftKey) {
      System.events.emit(SystemEvent.CHAT_INPUT_APPEND_TEXT, id);
      return;
    }
    System.events.emit(SystemEvent.SHOW_PREVIEW, {
      type: "furniture",
      spriteSheet: furnitureData.spriteSheet,
      texture,
      name: furnitureData.label,
    });
  });
  return $sprite.getComponent(furnitureFrameComponent);
};
