import React from "react";
import { Component } from "react";
import GameTimer from "./GameTimer";
import { GameEntity, PipeEntity, PlayerEntity } from "./GameEntities";
import { GameInfo, GamePhase } from "./GameTypes";
import Trumpetv3 from "./Trumpetv3.png";
import Cookies from "universal-cookie";
// import { Console } from "console";

// Game properties object, contains information passed down from a parent component.
interface GameProps {
  // Desired canvas width in pixels
  width: number,

  // Desired canvas height in pixels
  height: number,

  // Desired player height, between 0 and 100
  input: number,

  // Desired game phase to transition to, externally requested and possibly not acted upon
  requestedPhase: GamePhase | null,

  // Callback invoked on changing game phase
  // lastPhase: Phase before change
  // newPhase: Phase after change
  // info: Information about externally-relevant game state like score
  onPhaseChangeCallback?(lastPhase: GamePhase, newPhase: GamePhase, info: GameInfo): void
}

// Game state object, representing current game state
interface GameState {
  // Current game phase
  phase: GamePhase,

  // List of all entities to be updated
  entities: GameEntity[],

  // Next unused entity ID
  nextEID: number,

  // Player entity object
  player: PlayerEntity | null

  // Time since the last pipe was spawned in seconds
  sinceLastPipe: number,

  // Information about the current game like score
  info: GameInfo,

  // Phase the game was in before a pause, if any
  prePausePhase: GamePhase,

  // Image to use as the player sprite
  playerSprite: HTMLImageElement | null,

  // Cookies object
  cookies: Cookies,

  // Top 3 high scores
  highScore1: string,
  highScore2: string,
  highScore3: string
}


// Game component, encapsulating a canvas and performing operations on game entities based on state machine logic.
// Exposes interfaces for external modification and viewing of game state by other components.
class Game extends Component<GameProps, GameState> {

  // Canvas element reference
  canvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: GameProps) {
    super(props);

    // Initialize cookies, set initial high scores
    const  cookies: Cookies  = new Cookies();
    cookies.set("highScore1", "AAA,0", {});
    cookies.set("highScore2", "AAA,0", {});
    cookies.set("highScore3", "AAA,0", {});

    // Initialize state
    this.state = {
      phase: GamePhase.LOAD,
      entities: [],
      nextEID: 0,
      player: null,
      sinceLastPipe: 0,
      info: this.initInfo(),
      prePausePhase: GamePhase.LOAD,
      playerSprite: null,
      cookies: cookies,
      highScore1: cookies.get('highScore1'),
      highScore2: cookies.get('highScore2'),
      highScore3: cookies.get('highScore3')
    }

    // Initialize canvas
    this.canvas = React.createRef();
  }

  // Called when the component first mounts on the page
  componentDidMount() {
    // Fetch assets
    this.fetchAndSaveImages()
  }

  // Fetches and saves assets like player sprites, transitions game to the Ready state on loading.
  fetchAndSaveImages() {
    let pSprite: HTMLImageElement = new Image();
    pSprite.onload = () => {
      // Called once the sprite at the given source is loaded
      this.setState({
        playerSprite: pSprite
      })
      // Ready the game after the player sprite is loaded
      this.transitionPhase(GamePhase.READY);
    }
    pSprite.src = Trumpetv3;
  }

  // Called once every time the component is updated externally
  componentDidUpdate() {
    if (this.props.requestedPhase !== this.state.phase) {
      // someone wants us to externally change the game phase, try to do so if possible
      switch(this.props.requestedPhase) {
        case GamePhase.INIT:
          // always allow resetting the game
          this.transitionPhase(GamePhase.INIT);
          break;
        case GamePhase.PAUSED:
          // transition to pause, but save the previous state so it can be returned
          this.setState({ prePausePhase: this.state.phase });
          this.transitionPhase(GamePhase.PAUSED);
          break;
        case GamePhase.UNPAUSED:
          // only unpause if we're currently paused
          if (this.state.phase === GamePhase.PAUSED) {
            this.transitionPhase(GamePhase.UNPAUSED);
          }
          break;
      }
    }
  }

  // Returns an initialized GameInfo object
  initInfo = () => {
    return {
      score: 0
    };
  }

  // Returns the current input value passed in by a parent component
  getInputFunc = () => this.props.input;

  // game startup/reset; run once when game starts up/resets
  initGame = () => {
    this.transitionPhase(GamePhase.INIT);
  }

  // Transitions the current phase to the next phase, invoking the onPhaseChange callback
  transitionPhase = (nextPhase: GamePhase) => {
    let lastPhase = this.state.phase;

    this.setState({ phase: nextPhase }, () => {
      this.props.onPhaseChangeCallback?.(lastPhase, this.state.phase, this.state.info)
    });
  }

  // Ticks game logic, called every frame by the GameTimer
  // dt: time in seconds since last frame
  tickGame = (dt : number) => {
    let player: PlayerEntity;
    let entities: GameEntity[];
    let EID = this.state.nextEID;

    switch(this.state.phase) {
      case GamePhase.LOAD:
        // do nothing
        break;
      case GamePhase.READY:
        // do nothing
        break;
      case GamePhase.INIT:
        // initialize the game
        // set up entities to contain a new player
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

        // start updating on the next frame
        this.transitionPhase(GamePhase.ALIVE);
        break;

      case GamePhase.ALIVE:
        // player is currently alive, tick all entities

        // check to make sure the player hasn't died
        player = this.state.player!;  // player is definitely not null
        entities = this.state.entities;
        let pipes = this.state.entities.filter(e => e.name === "pipe");

        if (pipes.some((e: GameEntity) => (e as PipeEntity).inDangerZone(player.x, player.y))
              || player.y < 0 || player.y > 100) {
          // there's at least one pipe we're in the danger zone of, we died :(
          this.transitionPhase(GamePhase.DEAD);

          // checks whether new high score and adds it if it is
          this.handleCookie(this.state.info.score)
          break;
        }

        // check to see how long it's been since we spawned a pipe; if it's been 3 seconds, spawn a new pipe
        // let sinceLastPipe = this.state.sinceLastPipe;
        let lastPipeLoc = 100;
        if (pipes.length > 0) {
          lastPipeLoc = (pipes.reduce((a, b) => b["x"] >= a["x"] ? b : a) as PipeEntity).x;
        }
        if (pipes.length === 0 || lastPipeLoc < 75){
          // either there are no pipes or the rightmost pipe is far enough left, spawn a new pipe
          this.state.entities.push(new PipeEntity(EID++, Math.random() * 60 + 20, 5, 20));
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
          // sinceLastPipe: sinceLastPipe + dt,
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

    // get canvas context
    let ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      canvas.width = this.props.width;
      canvas.height = this.props.height;

      // Draw a solid blue background
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw every entity
      this.state.entities.map((e: GameEntity) => {
        e.draw(dt, canvas!, ctx!);
        return e;
      });
    }
  }

  //called whenever you die and updates high scores if applicable
  handleCookie = (score: number) => {
    const cookies: Cookies = this.state.cookies
    const hs1String: string = cookies.get("highScore1");
    const hs2String: string = cookies.get("highScore2");
    const hs3String: string = cookies.get("highScore3");
    const hs1Elem: string[] = hs1String.split(",");
    const hs2Elem: string[] = hs2String.split(",");
    const hs3Elem: string[] = hs3String.split(",");
    const hs1: number = parseFloat(hs1Elem[1]);
    const hs2: number = parseFloat(hs2Elem[1]);
    const hs3: number = parseFloat(hs3Elem[1]);
    if (score > hs3) {
      // score is at least greater than the lowest high score
      let resp: string|null = window.prompt("You got a new highscore!! Enter your initials")
      while (resp === null || resp.length !== 3) {
        // retry prompting until the player enters a correct name
        resp = window.prompt("You got a new highscore!! Enter your initials")
      }
      const newHighScore: string = resp + "," + score
      if (score > hs2) {
        cookies.set("highScore3", hs2String, {});
        if (score > hs1) {
          cookies.set("highScore2", hs1String, {});
          cookies.set("highScore1", newHighScore, {});
        } else {
          cookies.set("highScore2", newHighScore, {});
        }
      } else {
        cookies.set("highScore3", newHighScore, {});
      }
    }
    this.setState(
        {
          highScore1: cookies.get('highScore1'),
          highScore2: cookies.get('highScore2'),
          highScore3: cookies.get('highScore3')
        }
    )
  };

  render() {
    return (
      <div className="Game">
        <GameTimer
          onTickCallback = { this.tickGame }
          postTickCallback = { this.drawGame }
        />
        {/*<p>X position: { this.state.player?.x }</p>*/}
        {/*<p>Y position: { this.state.player?.y }</p>*/}
        <p>Game Phase: { this.state.phase }</p>
        <p>Score: { this.state.info.score }</p>
        <p>HighScore1: {this.state.highScore1}</p>
        <p>HighScore2: {this.state.highScore2}</p>
        <p>HighScore3: {this.state.highScore3}</p>
        {/*<button onClick={ this.initGame }>Reset game</button>-->*/}
        <canvas className="gameCanvas" ref={ this.canvas }/>
      </div>
    );
  }
}

export default Game;
