import React, { useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import WorkerBuilder from './WorkerBuilder';
import Worker from "./Fibonacci.worker";

const instance = new WorkerBuilder(Worker);

function App() {
  useEffect(() => {
    instance.onmessage = (event: MessageEvent) => {
      console.log("message!!");
      if (event) {
        console.log(event.data % 100);
      }
    }
  }, [instance]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

        <button
          onClick={() => {
            instance.postMessage(1000000000);
          }}
        >
          Send Message
        </button>
      </header>
    </div>
  );
}

export default App;
