import React from "react";
import { Component } from "react";
import GameTimer from "./GameTimer";
import { GameEntity, PipeEntity, PlayerEntity } from "./GameEntities";
import { GameInfo, GamePhase } from "./GameTypes";
import Trumpetv3 from "./Trumpetv3.png";
import Cookies from "universal-cookie";
import { convertTypeAcquisitionFromJson } from "typescript";
// import { Console } from "console";

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
  loPitch: number,
  hiPitch: number,
  info: GameInfo,
  prePausePhase: GamePhase,
  playerSprite: HTMLImageElement | null,
  cookies: Cookies,
  highScore1: string,
  highScore2: string,
  highScore3: string
}

class Game extends Component<GameProps, GameState> {
  static notesArray: string[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  static notesMap = new Map([["C", 0], ["C#", 1], ["D", 2], ["D#", 3], ["E", 4], ["F", 5], ["F#", 6],
    ["G", 7], ["G#", 8], ["A", 9], ["A#", 10], ["B", 11]]);
  canvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: any) {
    super(props);

    const  cookies: Cookies  = new Cookies();
    cookies.set("highScore1", "AAA,0", {});
    cookies.set("highScore2", "AAA,0", {});
    cookies.set("highScore3", "AAA,0", {});

    this.state = {
      phase: GamePhase.LOAD,
      entities: [],
      nextEID: 0,
      player: null,
      sinceLastPipe: 0,
      loPitch: 48,
      hiPitch: 60,
      info: this.initInfo(),
      prePausePhase: GamePhase.LOAD,
      playerSprite: null,
      cookies: cookies,
      highScore1: cookies.get('highScore1'),
      highScore2: cookies.get('highScore2'),
      highScore3: cookies.get('highScore3')
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
      // this.initGame() // start the game after the player sprite is loaded
      this.transitionPhase(GamePhase.READY);
    }
    pSprite.src = Trumpetv3;
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

  getInputFunc = () => {
    let position = (Game.pitchNumberFromFreq(this.props.input) - this.state.loPitch) * 100 / (this.state.hiPitch - this.state.loPitch);
    if (position > 100) {
      position = 100;
    } else if (position < 0) {
      position = 0;
    }
    return position;
  };

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
      case GamePhase.LOAD:
        break;
      case GamePhase.READY:
        break;
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
          // checks whether new high score and adds it if it is
          this.handleCookie(this.state.info.score)
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

  // Takes note number (in midi scheme such that C4 is note 60) and returns it as a string in
  // normal musical notation (letter-based with octave number at end). Returns sharps, not flats.
  // If the given number is not an integer, it is rounded to the nearest note.
  static pitchLetterFromNumber = (pitch: number) => {
    const roundedPitch: number = Math.round(pitch);
    const octave: number = Math.floor((roundedPitch - 12) / 12);  // C0 is note 12, 12 notes in octave
    const note: string = Game.notesArray[(roundedPitch - 12) % 12];
    return note + octave;
  }

  // Takes note in letter form (pitch letter followed by optional # then octave number) and returns
  // a pitch in midi number form (where C4 is note 60). Accepts sharps, not flats.
  static pitchNumberFromLetter = (note: string) => {
    const splitPoint: number = note.search(/-|[0-9]/);
    const letterNote: string = note.substring(0, splitPoint);
    const octave: number = parseInt(note.substring(splitPoint, note.length));
    const letterNoteNumber: number | undefined = Game.notesMap.get(letterNote);
    if (letterNoteNumber === undefined) {
      throw new Error("Letter note " + letterNote + " is not defined!");
    }
    return octave * 12 + (letterNoteNumber + 12);
  }

  // Returns the midi pitch number from a frequency in Hz
  static pitchNumberFromFreq = (freq: number) => {
    return 12 * Math.log2(4 / 55 * Math.pow(2, 0.75) * freq);
  }

  // Returns the frequency of a midi pitch
  static freqFromPitchNumber = (pitch: number) => {
    return 440 * Math.pow(2, (pitch - 69) / 12);
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

      // grid lines
      const fontSize = 28 - (this.state.hiPitch - this.state.loPitch);
      ctx.strokeStyle = "red";
      ctx.fillStyle = "red";
      ctx.font = fontSize + "px Arial";
      for (let i = this.state.loPitch + 1; i < this.state.hiPitch; i++) {
        let y = (i - this.state.loPitch) * this.props.height / (this.state.hiPitch - this.state.loPitch);
        y = canvas.height - y;
        ctx.beginPath();
        ctx.moveTo(fontSize * 2.2, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.fillText(Game.pitchLetterFromNumber(i), 5, y + fontSize / 2);
      }

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
      let resp: string|null = window.prompt("You got a new highscore!! Enter your initials")
      while (resp === null || resp.length !== 3) {
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
