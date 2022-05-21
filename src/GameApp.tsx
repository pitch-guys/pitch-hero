import { useEffect, useState } from 'react';
import "./Game.css";
import Game from "./Game";
import { GameInfo, GamePhase } from './GameTypes';
import AudioContextFunction from "./contexts/AudioContext";
import autoCorrelate from "./libs/AutoCorrelate";
// import { maxHeaderSize } from 'http';

const AudioContext = new AudioContextFunction();


interface GameAppProps {
  onInit?(): void,
  onDeath?(info: GameInfo): void
}

function GameApp(props: GameAppProps) {
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth * 0.8);
  const [canvasHeight, setCanvasHeight] = useState(250);
  const [pitch, setPitch] = useState(50);
  const [position, setPosition] = useState(50);
  const [loFreq, setLoFreq] = useState(100);
  const [hiFreq, setHiFreq] = useState(400);
  const [currentPhase, setCurrentPhase] = useState(GamePhase.INIT);
  // const [pauseInfo, setPauseInfo] = useState<{paused: boolean, previous: GamePhase}>({ paused: false, previous: GamePhase.INIT});
  const [requestedPhase, setRequestedPhase] = useState<GamePhase | null>(null);
  const [source, setSource] = useState<any|null>(null);
  const [started, setStart] = useState(false);
  const audioCtx = AudioContext.getAudioContext();
  const analyserNode = AudioContext.getAnalyser();
  const buflen = 2048;
  var buf = new Float32Array(buflen);
  // const onInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setGameInput(parseInt(e.target.value));
  // }

  const updatePitch = (time: any) => {
    analyserNode.getFloatTimeDomainData(buf);
    var ac = autoCorrelate(buf, audioCtx.sampleRate);
    if (ac > -1) {
      // let note = noteFromPitch(ac);
      // let sym = noteStrings[note % 12];
      // let scl = Math.floor(note / 12) - 1;
      // let dtune = centsOffFromPitch(ac, note);
      setPitch(ac);
      // setPitchNote(sym);
      // setPitchScale(scl);
      // setDetune(dtune);
      // setNotification(false);
      // console.log(note, sym, scl, dtune, ac);
      // updatePosition(ac, loFreq, hiFreq, 100);
    }
  };

  // Updates the position of Bibby (to be passed to Game) based on a given input frequency. Takes
  // in min and max frequencies where input frequencies outside of this range will simply be
  // mapped to the top and bottom positions. Scales frequencies within the range to span the whole
  // height.
  const updatePosition = (freq: number, minFreq: number, maxFreq: number, height: number) => {
    let pos: number = (freq - minFreq) / (maxFreq - minFreq) * height;  // scale freq within range
    if (pos < 0) {  // keep pos within box if going out of bounds
      pos = 0;
    } else if (pos > height) {
      pos = height
    }
    setPosition(pos);
  }

  setInterval(updatePitch, 1);

  const start = async () => {
    const input = await getMicInput();

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    setStart(true);
    // setNotification(true);
    // setTimeout(() => setNotification(false), 5000);
    setSource(audioCtx!.createMediaStreamSource(input));
  };

  const stop = () => {
    source!.disconnect(analyserNode);
    setStart(false);
  };

  const getMicInput = () => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        autoGainControl: false,
        noiseSuppression: false,
        latency: 0,
      },
    });
  };

  const onPhaseChanged = (lastPhase: GamePhase, newPhase: GamePhase, info: GameInfo) => {
    console.log(`Transitioned from ${lastPhase} to ${newPhase}`);
    
    if (newPhase === requestedPhase) {
      // our request has been answered
      setRequestedPhase(null);
    }

    setCurrentPhase(newPhase);

    switch (newPhase) {
      case GamePhase.INIT:
        props.onInit?.();
        break;
      case GamePhase.ALIVE:
        break;
      case GamePhase.DEAD:
        // alert(`Player died! Passed ${info.score} pipes before dying!`)
        props.onDeath?.(info);
        break;
      case GamePhase.PAUSED:
        break;
    }
  }

  const onResetClicked = () => {
    setRequestedPhase(GamePhase.INIT);
  }

  const onPauseClicked = () => {
    if (currentPhase !== GamePhase.PAUSED) {
      setRequestedPhase(GamePhase.PAUSED);
    } else {
      setRequestedPhase(GamePhase.UNPAUSED);
    }
  }

  useEffect(() => {
    const handleResize = () => {
      setCanvasHeight(250);
      setCanvasWidth(window.innerWidth * 0.8);
    }

    window.addEventListener('resize', handleResize);
  });

  useEffect(() => {
    if (source != null) {
      source!.connect(analyserNode);
    }
  }, [source, analyserNode]);

  return (
    
    <div className="Game-App">
      {!started ? (
          <button
            onClick={start}
          >
            Start microphone
          </button>
        ) : (
          <button
            className="bg-red-800 text-white w-20 h-20 rounded-full shadow-xl transition-all"
            onClick={stop}
          >
            Stop microphone
          </button> 
        )}
        <span>{pitch}</span>
        <span>{Game.pitchLetterFromNumber(Game.pitchNumberFromFreq(pitch))}</span>
        {/*
        <span>Minimum Frequency: <input type="number" min={ 0 } value={ loFreq } onChange={ (event) => setLoFreq(event.target.valueAsNumber) }/></span>
        <span>Maximum Frequency: <input type="number" min={ 0 } value={ hiFreq } onChange={ (event) => setHiFreq(event.target.valueAsNumber) }/></span>
        */}
        <Game 
        width={ canvasWidth }
        height={ canvasHeight }
        input={ pitch }
        requestedPhase={ requestedPhase }
        onPhaseChangeCallback={ onPhaseChanged }
      />
      <button onClick={ onResetClicked }> {currentPhase === GamePhase.READY ? "Start" : "Reset"} game</button>
      <button onClick={ onPauseClicked }> {currentPhase === GamePhase.PAUSED? "Unpause" : "Pause"} game</button>
    </div>
  );
}

export default GameApp;
