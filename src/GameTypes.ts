export enum GamePhase {
  INIT = "INIT",
  ALIVE = "ALIVE",
  DEAD = "DEAD",
  PAUSED = "PAUSED",
  UNPAUSED = "UNPAUSED"
};

export interface GameInfo {
  score: number
  // eventually, we can add more things to keep track of here
}