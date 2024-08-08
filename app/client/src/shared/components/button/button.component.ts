import {
  container,
  ContainerComponent,
  Cursor,
  EventMode,
  HorizontalAlign,
  textSprite,
} from "@tu/tulip";
import { SpriteSheetEnum } from "shared/enums";

type InputProps = {
  width: number;
  text: string;
};

export const buttonComponent: ContainerComponent<InputProps> = (props) => {
  const $container = container<InputProps>(props);

  const { text, width } = $container.getProps();

  const $button = textSprite({
    spriteSheet: SpriteSheetEnum.DEFAULT_FONT,
    color: 0xffffff,
    eventMode: EventMode.STATIC,
    cursor: Cursor.POINTER,
    backgroundColor: 0x222222,
    backgroundAlpha: 1,
    size: {
      width,
      height: 7,
    },
    backgroundPadding: {
      top: 4,
      right: 8,
      bottom: 3,
      left: 8,
    },
    horizontalAlign: HorizontalAlign.CENTER,
    text,
  });
  $container.add($button);

  return $container.getComponent(buttonComponent);
};
