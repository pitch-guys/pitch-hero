import React from "react";
import { Component } from "react";
import GameTimer from "./GameTimer";
import { GameEntity, PipeEntity, PlayerEntity } from "./GameEntities";
import { GameInfo, GamePhase } from "./GameTypes";
import { Console } from "console";

interface GameProps {
  width: number,
  height: number,
  input: number,
  requestedPhase: GamePhase | null,    // externally requested state change
  onPhaseChangeCallback?(lastPhase: GamePhase, newPhase: GamePhase, info: GameInfo): void
}

interface GameState {
  phase: GamePhase,
  entities: GameEntity[],
  nextEID: number,
  player: PlayerEntity | null
  sinceLastPipe: number,
  info: GameInfo,
  prePausePhase: GamePhase,
  playerSprite: HTMLImageElement | null;
}

class Game extends Component<GameProps, GameState> {
  canvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: any) {
    super(props);

    this.state = {
      phase: GamePhase.INIT,
      entities: [],
      nextEID: 0,
      player: null,
      sinceLastPipe: 0,
      info: this.initInfo(),
      prePausePhase: GamePhase.INIT,
      playerSprite: null
    }

    this.canvas = React.createRef();
  }

  componentDidMount() {
    this.fetchAndSaveImages()
  }

  fetchAndSaveImages() {
    let pSprite: HTMLImageElement = new Image();
    pSprite.onload = () => {
      this.setState({
        playerSprite: pSprite
      })
      this.initGame() // start the game after the player sprite is loaded
    }
    pSprite.src = "./Trumpetv3.png";
  }

  componentDidUpdate() {
    if (this.props.requestedPhase !== this.state.phase) {
      // someone wants us to externally change the game phase, try to do so if possible
      switch(this.props.requestedPhase) {
        case GamePhase.INIT:
          // always allow resetting the game
          this.transitionPhase(GamePhase.INIT);
          break;
        case GamePhase.PAUSED:
          this.setState({ prePausePhase: this.state.phase });
          this.transitionPhase(GamePhase.PAUSED);
          break;
        case GamePhase.UNPAUSED:
          this.transitionPhase(GamePhase.UNPAUSED);
          break;
      }
    }
  }

  initInfo = () => {
    return {
      score: 0
    };
  }

  getInputFunc = () => this.props.input;

  // game startup/reset; run once when game starts up/resets
  initGame = () => {
    this.transitionPhase(GamePhase.INIT);
  }

  transitionPhase = (nextPhase: GamePhase) => {
    let lastPhase = this.state.phase;

    this.setState({ phase: nextPhase }, () => {
      this.props.onPhaseChangeCallback?.(lastPhase, this.state.phase, this.state.info)
    });
  }

  // game tick, called once every frame
  // dt: time in seconds since last frame
  tickGame = (dt : number) => {
    let player: PlayerEntity;
    let entities: GameEntity[];
    let EID = this.state.nextEID;
    switch(this.state.phase) {
      case GamePhase.INIT:
        // start updating game on the next frame
        player = new PlayerEntity(EID++, this.getInputFunc, this.state.playerSprite);
        entities = [];
        entities.push(player);

        this.setState({
          entities: entities,
          nextEID: EID,
          player: player,
          sinceLastPipe: Infinity,
          info: this.initInfo()
        });
        this.transitionPhase(GamePhase.ALIVE);
        break;

      case GamePhase.ALIVE:
        // check to make sure the player hasn't died
        player = this.state.player!;  // player is definitely not null
        entities = this.state.entities;

        let canvas = this.canvas.current;
        if (canvas) {
          canvas.width = this.props.width;
          canvas.height = this.props.height;
        }

        if (this.state.entities.some((e: GameEntity) => e.name === "pipe"
                                                        && (e as PipeEntity).inDangerZone(player.x, player.y, canvas!))
              || player.y < 0 || player.y > 100) {
          // there's at least one pipe we're in the danger zone of, we died :(
          this.transitionPhase(GamePhase.DEAD);
          break;
        }

        // check to see how long it's been since we spawned a pipe; if it's been 3 seconds, spawn a new pipe
        let sinceLastPipe = this.state.sinceLastPipe;
        if (sinceLastPipe > 3) {
          this.state.entities.push(new PipeEntity(EID++, Math.random() * 60 + 20, 5, 20));
          sinceLastPipe = 0;
        }

        // update score for every pipe the player is past the danger zone of and hasn't yet awarded points
        let info = this.state.info;
        this.state.entities.filter(e => e.name === "pipe").map(e => {
          let pipe = e as PipeEntity;
          if ((pipe.x + pipe.width / 2) < player.x && !pipe.awardedPoints) {
            info.score++;
            pipe.awardedPoints = true;
          }
          return e;
        });

        // tick each entity
        this.state.entities.map((e: GameEntity) => {
          e.tick(dt);
          return e;
        });

        // queue a setstate to update entities, remove any entities that should be dead
        this.setState({
          entities: this.state.entities.filter((e: GameEntity) => !e.shouldRemove()),
          nextEID: EID,
          sinceLastPipe: sinceLastPipe + dt,
          info: info
        });
        break;

      case GamePhase.DEAD:
        // sit forever without doing any special ticking, we're dead lol
        break;

      case GamePhase.PAUSED:
        // sit forever, unpausing only happens externally
        break;

      case GamePhase.UNPAUSED:
        // we want to unpause, return to whatever the state was beforehand
        this.transitionPhase(this.state.prePausePhase);
        this.setState({ prePausePhase: GamePhase.INIT });
        break;
    }
  }

  // render canvas, called every frame after tickGame
  // note: DON'T do any setState in here
  drawGame = (dt: number) => {
    let canvas = this.canvas.current;
    let ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      canvas.width = this.props.width;
      canvas.height = this.props.height;

      // background
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      this.state.entities.map((e: GameEntity) => {
        e.draw(dt, canvas!, ctx!);
        return e;
      });
    }
  }

  render() {
    return (
      <div className="Game">
        <GameTimer
          onTickCallback = { this.tickGame }
          postTickCallback = { this.drawGame }
        />
        <p>Game Phase: { this.state.phase }</p>
        <p>X position: { this.state.player?.x }</p>
        <p>Y position: { this.state.player?.y }</p>
        <p>Score: { this.state.info.score }</p>
        {/*<button onClick={ this.initGame }>Reset game</button>-->*/}
        <canvas className="gameCanvas" ref={ this.canvas }/>
      </div>
    );
  }
}

export default Game;
