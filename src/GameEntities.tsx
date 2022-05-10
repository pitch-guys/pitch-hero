export class GameEntity {
  name: string;
  x: number;
  y: number;
  id: number;


  constructor(name: string, id: number, x: number, y: number) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.id = id;
  }

  setX(x: number) {
    this.x = x;
  }

  setY(y: number) {
    this.y = y;
  }

  tick(dt: number) { }

  draw(dt: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) { }

  shouldRemove(): boolean { return false; }
}

export class PlayerEntity extends GameEntity {
  getInputFunc: () => number;
  sprite: HTMLImageElement | null;

  constructor(id: number, getInputFunc: () => number, sprite: HTMLImageElement | null) {
    super("player", id, 5, 50);
    this.getInputFunc = getInputFunc;
    this.sprite = sprite;
  }

  tick(dt: number) {
    this.setY(this.getInputFunc());
  }

  draw(dt: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    let size = (5 / 100.0) * canvas.height;
    let blockX = (this.x / 100.0) * canvas.width;
    let blockY = (1 - this.y / 100.0) * canvas.height;

    if (this.sprite != null) {
      ctx.drawImage(this.sprite, blockX - size / 2, blockY - size / 2, size, size);
    }
  }
}

export class PipeEntity extends GameEntity {

  width: number;
  gap: number;
  awardedPoints: boolean

  constructor(id: number, y: number, width: number, gap: number) {
    super("pipe", id, 110, y);
    this.width = width;
    this.gap = gap;
    this.awardedPoints = false;
  }

  tick(dt: number) {
    // this.setY(this.getInputFunc());
    this.setX(this.x - dt * 10);
  }

  draw(dt: number, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    // canvas space from game space
    let x = (this.x / 100.0) * canvas.width;
    let y = (1 - this.y / 100.0) * canvas.height;
    let width = (this.width / 100.0) * canvas.width;
    let gap = (this.gap / 100.0) * canvas.height;

    ctx.fillStyle = "green";

    // top
    ctx.beginPath();
    ctx.fillRect(x - width / 2, 0, width, y - gap / 2);

    ctx.fillRect(x - width / 2, y + gap / 2, width, canvas.height);
  }

  shouldRemove(): boolean {
    return this.x < -10;
  }

  inDangerZone(x: number, y: number, canvas: HTMLCanvasElement): boolean {
    let leftEdge = this.x - this.width / 2;
    let rightEdge = this.x + this.width / 2;
    let topLip = this.y + this.gap / 2;
    let bottomLip = this.y - this.gap / 2;
    return x > leftEdge && x < rightEdge && (y + 2 > topLip || y - 2 < bottomLip);
  }
}