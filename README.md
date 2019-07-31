# yield-curve-sonification
An experiment to visualise and sonify the yield curve as featured in the [Financial Times Chart Doctor series](https://www.ft.com/content/80269930-40c3-11e9-b896-fe36ec32aece)

## Usage

Clone/download the repo and simply run the folder using browser-sync or similar. All assets are localised to support live performance. There are no other dependencies.

## Making sound

This project makes use of the d3js.js and webmidi.js libraries to visualise and sonify US yield curve data. The sonification maps data to musical pitches. The notes themselves are output as note messages on MIDI channels 1 through 4. Due to MIDI browser implementation, this is supported in Chrome only.

To actually hear a sound you need to establish a connection between Chrome and a valid MIDI-enabled sound source. In my published project, I used Apple Logic Pro. But you could also use an in-browser solution such as [websynths.com](https://websynths.com/) - or connect to a hardware synthesizer using an appropriate MIDI interface.