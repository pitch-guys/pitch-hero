import React from "react";
import { Component } from "react";
import GameTimer from "./GameTimer";
import { GameEntity, PipeEntity, PlayerEntity } from "./GameEntities";
import { GameDifficulty, GameInfo, GamePhase } from "./GameTypes";
import Trumpet from "./Trumpetv3.png";
import Background from "./Backgroundv4.png";
import Cookies from "universal-cookie";
import { convertTypeAcquisitionFromJson } from "typescript";
// import { Console } from "console";

const MAX_HIGHSCORES = 3;

// Game properties object, contains information passed down from a parent component.
interface GameProps {
  // Desired canvas width in pixels
  width: number,

  // Desired canvas height in pixels
  height: number,

  // Input frequency used to determine player height
  input: number,

  // Desired minimum note on the grid as a string, updates state on game reset if valid
  loNote: string,

  // Desired minimum note on the grid as a string, updates state on game reset if valid
  hiNote: string,

  // Desired game phase to transition to, externally requested and possibly not acted upon
  requestedPhase: GamePhase | null,

  // Desired game difficulty to transition to
  requestedDifficulty: GameDifficulty,

  // Callback invoked on changing game phase
  // lastPhase: Phase before change
  // newPhase: Phase after change
  // info: Information about externally-relevant game state like score
  onPhaseChangeCallback?(lastPhase: GamePhase, newPhase: GamePhase, info: GameInfo): void

  // Callback invoked on changing game difficulty
  // lastDiff: Difficulty before change
  // newDiff: Difficulty after change
  // info: Information about externally-relevant game state like score
  onDiffChangeCallback?(lastDiff: GameDifficulty, newDiff: GameDifficulty, info: GameInfo): void
}

// Game state object, representing current game state
interface GameState {
  // Current game phase
  phase: GamePhase,

  // Current game difficulty
  difficulty: GameDifficulty,

  // List of all entities to be updated
  entities: GameEntity[],

  // Next unused entity ID
  nextEID: number,

  // Player entity object
  player: PlayerEntity | null

  // Time since the last pipe was spawned in seconds
  sinceLastPipe: number,

  // Upper and lower pitch bounds
  loPitch: number,
  hiPitch: number,

  // Information about the current game like score
  info: GameInfo,

  // Phase the game was in before a pause, if any
  prePausePhase: GamePhase,

  // Image to use as the player sprite
  playerSprite: HTMLImageElement | null,
  
  // Image to use as the background sprite
  backgroundSprite: HTMLImageElement | null,
  
  // Cookies object
  cookies: Cookies,

  // Top 3 high scores
  highScores: [string, number][]
}


// Game component, encapsulating a canvas and performing operations on game entities based on state machine logic.
// Exposes interfaces for external modification and viewing of game state by other components.
class Game extends Component<GameProps, GameState> {
  // Maps for reference converting between letter notes and numbers of the octave
  static notesArray: string[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  static notesMap = new Map([["C", 0], ["C#", 1], ["D", 2], ["D#", 3], ["E", 4], ["F", 5], ["F#", 6],
    ["G", 7], ["G#", 8], ["A", 9], ["A#", 10], ["B", 11]]);

  // Canvas element reference
  canvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: GameProps) {
    super(props);

    // Initialize cookies, set initial high scores
    const  cookies: Cookies  = new Cookies();
    if (!cookies.get("highScores")) {
      cookies.set("highScores", [], {});
    }

    // Initialize state
    this.state = {
      phase: GamePhase.LOAD,
      difficulty: GameDifficulty.NORMAL,
      entities: [],
      nextEID: 0,
      player: null,
      sinceLastPipe: 0,
      loPitch: 48,
      hiPitch: 60,
      info: this.initInfo(),
      prePausePhase: GamePhase.LOAD,
      playerSprite: null,
      backgroundSprite: null,
      cookies: cookies,
      highScores: cookies.get("highScores")
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
    let bSprite: HTMLImageElement = new Image();
    pSprite.onload = () => {
      // Called once the sprite at the given source is loaded
      this.setState({
        playerSprite: pSprite
      })
      // Ready the game after the player sprite is loaded
      this.transitionPhase(GamePhase.READY);
    }
    bSprite.onload = () => {
      this.setState({
        backgroundSprite: bSprite
      })
    }
    pSprite.src = Trumpet;
    bSprite.src = Background;
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
    if (this.props.requestedDifficulty !== this.state.difficulty) {
      this.transitionDiff(this.props.requestedDifficulty);
    }
  }

  // Returns an initialized GameInfo object
  initInfo = () => {
    return {
      score: 0
    };
  }

  // Translates received frequency into a pitch, then scales into a position on-screen.
  getInputFunc = () => {
    let position = (Game.pitchNumberFromFreq(this.props.input) - this.state.loPitch) * 100 /
      (this.state.hiPitch - this.state.loPitch);
    if (position > 100) {  // keep position within bounds
      position = 100;
    } else if (position < 0) {
      position = 0;
    }
    return position;
  }

  // game startup/reset; run once when game starts up/resets
  initGame = () => {
    this.transitionPhase(GamePhase.INIT);
    this.transitionDiff(this.state.difficulty);
  }

  // Transitions the current phase to the next phase, invoking the onPhaseChange callback
  transitionPhase = (nextPhase: GamePhase) => {
    let lastPhase = this.state.phase;

    this.setState({ phase: nextPhase }, () => {
      this.props.onPhaseChangeCallback?.(lastPhase, this.state.phase, this.state.info)
    });
  }

  // Transitions the current difficulty to the next difficulty, invoking the onDiffChange callback
  transitionDiff = (nextDiff: GameDifficulty) => {
    let lastDiff = this.state.difficulty;

    this.setState({ difficulty: nextDiff }, () => {
      this.props.onDiffChangeCallback?.(lastDiff, this.state.difficulty, this.state.info)
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

        // Ensure we have valid input for pitch range, and if so, update state accordingly
        let loPitchNumber: number;
        try {
          loPitchNumber = Game.pitchNumberFromLetter(this.props.loNote);
        } catch {
          window.alert('Invalid low note: "' + this.props.loNote + '"');
          this.transitionPhase(GamePhase.READY);
          break;
        }
        let hiPitchNumber: number;
        try {
          hiPitchNumber = Game.pitchNumberFromLetter(this.props.hiNote);
        } catch {
          window.alert('Invalid high note: "' + this.props.hiNote + '"');
          this.transitionPhase(GamePhase.READY);
          break;
        }
        if (loPitchNumber >= hiPitchNumber) {
          window.alert('Given low note "' + this.props.loNote + '" is not less than given high note "' + this.props.hiNote + '"');
          this.transitionPhase(GamePhase.READY);
          break;
        }
        this.setState({loPitch: loPitchNumber, hiPitch: hiPitchNumber});

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
        // size of the gap, varies based on difficulty
        let gap = 20; // default difficulty is NORMAL
        if (this.state.difficulty == GameDifficulty.HARD) {
          gap = 10;
        }
        if (this.state.difficulty == GameDifficulty.EASY) {
          gap = 30;
        }
        if (pipes.length === 0 || lastPipeLoc < 75){
          // either there are no pipes or the rightmost pipe is far enough left, spawn a new pipe
          this.state.entities.push(new PipeEntity(EID++, this.generateRandomPipeGap(), 5, gap));
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

  // Returns the midi pitch number from a frequency in Hz.
  static pitchNumberFromFreq = (freq: number) => {
    return 12 * Math.log2(4 / 55 * Math.pow(2, 0.75) * freq);
  }

  // Returns the frequency of a midi pitch.
  static freqFromPitchNumber = (pitch: number) => {
    return 440 * Math.pow(2, (pitch - 69) / 12);
  }

  // Generates a random position 0-100 for a pipe to spawn its gap such that the gap lines up
  // with a note on the grid. Excludes notes at the top and bottom of the range (which do not have
  // their own grid lines as they are at the edge of the game screen).
  generateRandomPipeGap = () => {
    return Math.floor(Math.random() * (this.state.hiPitch - this.state.loPitch - 2) + 1) * 100 /
      (this.state.hiPitch - this.state.loPitch);
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
      // draw the background
      if (this.state.backgroundSprite != null) {
        ctx.drawImage(this.state.backgroundSprite, 0, 0, canvas.width, canvas.height);
      }

      // draw grid lines
      const fontSize = 18;
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

      // draw every entity
      this.state.entities.map((e: GameEntity) => {
        e.draw(dt, canvas!, ctx!);
        return e;
      });
    }
  }

  //called whenever you die and updates high scores if applicable
  handleCookie = (score: number) => {
    const cookies: Cookies = this.state.cookies;
    let scores = cookies.get("highScores", {}) as [string, number][];

    if (scores.length > 0) {
      let [name, lowest] = scores[scores.length - 1];
      if (lowest >= score && scores.length >= MAX_HIGHSCORES) {
        // do nothing since we're lower than the lowest score
        return;
      }
    }
    // there are either no high scores or we're higher than the lowest, make a new entry
    let name = null;
    while (!name) {
      name = window.prompt("You got a new high score! Enter a name:");
    }

    // add score to the end, then sort all scores from highest to lowest (preserving internal order on ties)
    scores.push([name, score]);
    scores = scores.sort((a, b) => b[1] - a[1]);

    // remove lowest scores if we went over the max
    while (scores.length > MAX_HIGHSCORES) {
      scores.pop();
    }

    // update cookies and internal state
    cookies.set("highScores", scores, {});
    this.setState({ highScores: scores });
    // console.log(scores);
  };

  render() {
    const scores = this.state.highScores;
    const scoreList = scores.map(([name, score]: [string, number]) => {
      return <p>{name}: {score}</p>
    });
    return (
      <div className="Game">
        <GameTimer
          onTickCallback = { this.tickGame }
          postTickCallback = { this.drawGame }
        />
        {/*<p>X position: { this.state.player?.x }</p>*/}
        {/*<p>Y position: { this.state.player?.y }</p>*/}
        <div>
          <p>High Scores</p>
          {scoreList}
        </div>
        {/*<p>Game Phase: { this.state.phase }</p>*/}
        <p>Score: { this.state.info.score }</p>
        {/*<button onClick={ this.initGame }>Reset game</button>-->*/}
        <canvas className="gameCanvas" ref={ this.canvas }/>
      </div>
    );
  }
}

export default Game;
