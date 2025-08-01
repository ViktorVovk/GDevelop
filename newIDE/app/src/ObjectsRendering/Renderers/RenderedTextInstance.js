// @flow
import RenderedInstance from './RenderedInstance';
import PixiResourcesLoader from '../../ObjectsRendering/PixiResourcesLoader';
import ResourcesLoader from '../../ResourcesLoader';
import { rgbStringToHexNumber } from '../../Utils/ColorTransformer';
import * as PIXI from 'pixi.js-legacy';
const gd: libGDevelop = global.gd;

/**
 * Renderer for a Text object.
 */
export default class RenderedTextInstance extends RenderedInstance {
  _isItalic: boolean = false;
  _isBold: boolean = false;
  _characterSize: number = 0;
  _wrapping: boolean = false;
  _wrappingWidth: number = 0;
  _styleFontDirty: boolean = true;
  _fontName: string = '';
  _fontFamily: string = '';
  _color: string = '0;0;0';
  _textAlignment: string = 'left';
  _verticalTextAlignment: string = 'top';

  _isOutlineEnabled = false;
  _outlineColor = '255;255;255';
  _outlineThickness = 2;

  _isShadowEnabled = false;
  _shadowDistance = 3;
  _shadowAngle = 90;
  _shadowColor = '0;0;0';
  _shadowOpacity = 127;
  _shadowBlurRadius = 2;

  constructor(
    project: gdProject,
    instance: gdInitialInstance,
    associatedObjectConfiguration: gdObjectConfiguration,
    pixiContainer: PIXI.Container,
    pixiResourcesLoader: Class<PixiResourcesLoader>,
    getPropertyOverridings: (() => Map<string, string>) | null
  ) {
    super(
      project,
      instance,
      associatedObjectConfiguration,
      pixiContainer,
      pixiResourcesLoader,
      getPropertyOverridings
    );

    const style = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: 20,
      align: 'left',
      padding: 5,
    });

    //Setup the PIXI object:
    this._pixiObject = new PIXI.Text('', style);
    this._pixiObject.anchor.x = 0.5;
    this._pixiObject.anchor.y = 0.5;
    this._pixiContainer.addChild(this._pixiObject);
    this._styleFontDirty = true;
    this.update();
  }

  onRemovedFromScene(): void {
    super.onRemovedFromScene();
    this._pixiObject.destroy(true);
  }

  /**
   * Return a URL for thumbnail of the specified object.
   */
  static getThumbnail(
    project: gdProject,
    resourcesLoader: Class<ResourcesLoader>,
    objectConfiguration: gdObjectConfiguration
  ) {
    return 'CppPlatform/Extensions/texticon24.png';
  }

  update() {
    const textObjectConfiguration = gd.asTextObjectConfiguration(
      this._associatedObjectConfiguration
    );
    const propertyOverridings = this.getPropertyOverridings();
    this._pixiObject.text =
      propertyOverridings && propertyOverridings.has('Text')
        ? propertyOverridings.get('Text')
        : textObjectConfiguration.getText();

    //Update style, only if needed to avoid destroying text rendering performances
    if (
      textObjectConfiguration.isItalic() !== this._isItalic ||
      textObjectConfiguration.isBold() !== this._isBold ||
      textObjectConfiguration.getCharacterSize() !== this._characterSize ||
      textObjectConfiguration.getTextAlignment() !== this._textAlignment ||
      textObjectConfiguration.getVerticalTextAlignment() !==
        this._verticalTextAlignment ||
      textObjectConfiguration.getColor() !== this._color ||
      textObjectConfiguration.isOutlineEnabled() !== this._isOutlineEnabled ||
      textObjectConfiguration.getOutlineColor() !== this._outlineColor ||
      textObjectConfiguration.getOutlineThickness() !==
        this._outlineThickness ||
      textObjectConfiguration.isShadowEnabled() !== this._isShadowEnabled ||
      textObjectConfiguration.getShadowDistance() !== this._shadowDistance ||
      textObjectConfiguration.getShadowAngle() !== this._shadowAngle ||
      textObjectConfiguration.getShadowColor() !== this._shadowColor ||
      textObjectConfiguration.getShadowOpacity() !== this._shadowOpacity ||
      textObjectConfiguration.getShadowBlurRadius() !==
        this._shadowBlurRadius ||
      this._instance.hasCustomSize() !== this._wrapping ||
      (this.getCustomWidth() !== this._wrappingWidth && this._wrapping)
    ) {
      this._isItalic = textObjectConfiguration.isItalic();
      this._isBold = textObjectConfiguration.isBold();
      this._characterSize = textObjectConfiguration.getCharacterSize();
      this._textAlignment = textObjectConfiguration.getTextAlignment();
      this._verticalTextAlignment = textObjectConfiguration.getVerticalTextAlignment();
      this._color = textObjectConfiguration.getColor();

      this._isOutlineEnabled = textObjectConfiguration.isOutlineEnabled();
      this._outlineColor = textObjectConfiguration.getOutlineColor();
      this._outlineThickness = textObjectConfiguration.getOutlineThickness();

      this._isShadowEnabled = textObjectConfiguration.isShadowEnabled();
      this._shadowDistance = textObjectConfiguration.getShadowDistance();
      this._shadowAngle = textObjectConfiguration.getShadowAngle();
      this._shadowColor = textObjectConfiguration.getShadowColor();
      this._shadowOpacity = textObjectConfiguration.getShadowOpacity();
      this._shadowBlurRadius = textObjectConfiguration.getShadowBlurRadius();

      this._wrapping = this._instance.hasCustomSize();
      this._wrappingWidth = this.getCustomWidth();
      this._styleFontDirty = true;
    }

    if (this._fontName !== textObjectConfiguration.getFontName()) {
      //Avoid calling loadFontFamily if the font didn't changed.
      this._fontName = textObjectConfiguration.getFontName();
      PixiResourcesLoader.loadFontFamily(
        this._project,
        textObjectConfiguration.getFontName()
      )
        .then(fontFamily => {
          if (this._wasDestroyed) return;

          // Once the font is loaded, we can use the given fontFamily.
          this._fontFamily = fontFamily;
          this._styleFontDirty = true;
        })
        .catch(err => {
          // Ignore errors
          console.warn(
            'Unable to load font family for RenderedTextInstance',
            err
          );
        });
    }

    if (this._styleFontDirty) {
      const style = this._pixiObject.style;
      style.fontFamily = this._fontFamily || 'Arial';
      style.fontSize = Math.max(1, this._characterSize);
      style.fontStyle = this._isItalic ? 'italic' : 'normal';
      style.fontWeight = this._isBold ? 'bold' : 'normal';
      style.fill = rgbStringToHexNumber(this._color);
      style.wordWrap = this._wrapping;
      style.wordWrapWidth = this._wrappingWidth <= 1 ? 1 : this._wrappingWidth;
      style.breakWords = true;
      style.align = this._textAlignment;

      style.stroke = rgbStringToHexNumber(this._outlineColor);
      style.strokeThickness = this._isOutlineEnabled
        ? this._outlineThickness
        : 0;
      style.dropShadow = this._isShadowEnabled;
      style.dropShadowColor = rgbStringToHexNumber(this._shadowColor);
      style.dropShadowAlpha = this._shadowOpacity / 255;
      style.dropShadowBlur = this._shadowBlurRadius;
      style.dropShadowAngle = RenderedInstance.toRad(this._shadowAngle);
      style.dropShadowDistance = this._shadowDistance;
      const extraPaddingForShadow = style.dropShadow
        ? style.dropShadowDistance + style.dropShadowBlur
        : 0;
      style.padding = Math.ceil(extraPaddingForShadow);

      // Manually ask the PIXI object to re-render as we changed a style property
      // see http://www.html5gamedevs.com/topic/16924-change-text-style-post-render/
      this._pixiObject.dirty = true;
      this._styleFontDirty = false;
    }

    if (this._instance.hasCustomSize() && this._pixiObject.width !== 0) {
      const alignmentX =
        this._textAlignment === 'right'
          ? 1
          : this._textAlignment === 'center'
          ? 0.5
          : 0;

      const width = this.getCustomWidth();

      // A vector from the custom size center to the renderer center.
      const centerToCenterX =
        (width - this._pixiObject.width) * (alignmentX - 0.5);

      this._pixiObject.position.x = this._instance.getX() + width / 2;
      this._pixiObject.anchor.x =
        0.5 - centerToCenterX / this._pixiObject.width;
    } else {
      this._pixiObject.position.x =
        this._instance.getX() + this._pixiObject.width / 2;
      this._pixiObject.anchor.x = 0.5;
    }
    const alignmentY =
      this._verticalTextAlignment === 'bottom'
        ? 1
        : this._verticalTextAlignment === 'center'
        ? 0.5
        : 0;
    this._pixiObject.position.y =
      this._instance.getY() + this._pixiObject.height * (0.5 - alignmentY);
    this._pixiObject.anchor.y = 0.5;

    this._pixiObject.rotation = RenderedInstance.toRad(
      this._instance.getAngle()
    );

    // Do not hide completely an object so it can still be manipulated
    const alphaForDisplay = Math.max(this._instance.getOpacity() / 255, 0.5);
    this._pixiObject.alpha = alphaForDisplay;
  }

  getDefaultWidth() {
    // The default width is dependent of the current wrapping width.
    // You should avoid to use this value.
    return this._pixiObject.width;
  }

  getDefaultHeight() {
    // The default height is dependent of the current wrapping width.
    // You should avoid to use this value.
    return this._pixiObject.height;
  }

  getOriginY(): number {
    const height = this.getHeight();
    return this._verticalTextAlignment === 'bottom'
      ? height
      : this._verticalTextAlignment === 'center'
      ? height / 2
      : 0;
  }
}
