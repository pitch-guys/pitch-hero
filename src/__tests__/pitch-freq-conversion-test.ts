import Game from "../Game";

it("pitchLetterFromNumber() returns correct values", () => {
    const ioMap = new Map([
        [60, "C4"],
        [61, "C#4"],
        [59, "B3"],
        [62, "D4"],
        [21, "A0"],
        [127, "G9"]
    ]);
    ioMap.forEach((value, key) => {
        expect(Game.pitchLetterFromNumber(key)).toEqual(value);
    });
});

it("pitchNumberFromLetter() returns correct values", () => {
    const ioMap = new Map([
        ["C4", 60],
        ["C#4", 61],
        ["B3", 59],
        ["D4", 62],
        ["A0", 21],
        ["G9", 127]
    ]);
    ioMap.forEach((value, key) => {
        expect(Game.pitchNumberFromLetter(key)).toEqual(value);
    });
});

it("pitchLetterFromNumber() and pitchNumberFromLetter() agree", () => {
    for (let note = 21; note < 128; note++) {
        expect(Game.pitchNumberFromLetter(Game.pitchLetterFromNumber(note))).toEqual(note);
    }
});

it("pitchNumberFromFreq() returns correct values", () => {
    const ioMap = new Map([
        [261.63, 60],
        [440.00, 69],
        [27.50, 21],
        [12543.85, 127]
    ]);
    ioMap.forEach((value, key) => {
        expect(Game.pitchNumberFromFreq(key)).toBeCloseTo(value, 1);
    });
});

it("pitchFreqFromNumber() returns correct values", () => {
    const ioMap = new Map([
        [60, 261.63],
        [69, 440.00],
        [21, 27.50],
        [127, 12543.85]
    ]);
    ioMap.forEach((value, key) => {
        expect(Game.freqFromPitchNumber(key)).toBeCloseTo(value, 1);
    });
});