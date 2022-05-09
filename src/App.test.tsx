import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import autoCorrelate from './libs/AutoCorrelate';
jest.mock('./contexts/AudioContext');
import bufObj from './_data/sampleBuffer';

test('renders learn react link', () => { 
  render(<App />);
  expect(true);
});

test('test autocorrelate algorithm on sample buffer', () => { 
  const buflen = 2048;
  var buf = new Float32Array(Object.values(bufObj));
  var actual = autoCorrelate(buf, 44100)
  var expected = 125.65664815465871
  expect(expected).toBe(actual);
});

