export enum GamePhase {
  LOAD = "LOAD",
  READY = "READY",
  INIT = "INIT",
  EASY = "EASY",
  NORMAL = "NORMAL",
  HARD = "HARD",
  ALIVE = "ALIVE",
  DEAD = "DEAD",
  PAUSED = "PAUSED",
  UNPAUSED = "UNPAUSED"
};

export interface GameInfo {
  score: number
  // eventually, we can add more things to keep track of here
}