export enum GamePhase {
  LOAD = "LOAD",
  READY = "READY",
  INIT = "INIT",
  ALIVE = "ALIVE",
  DEAD = "DEAD",
  PAUSED = "PAUSED",
  UNPAUSED = "UNPAUSED"
};

export enum GameDifficulty {
  EASY = "EASY",
  NORMAL = "NORMAL",
  HARD = "HARD"
}

export interface GameInfo {
  score: number
  // eventually, we can add more things to keep track of here
}