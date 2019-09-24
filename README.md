# yield-curve-sonification

An experiment to visualise and sonify the yield curve as featured in the [Financial Times Chart Doctor series](https://www.ft.com/content/80269930-40c3-11e9-b896-fe36ec32aece)

## Usage

Clone/download the repo and simply run the folder using browser-sync or similar. All assets are localised to support live performance without a network connection. There are no other dependencies.

## Making sound

Due to MIDI browser implementation, sound output is currently supported in Chrome only.

This project makes use of [d3js.js](https://d3js.org/) and [webmidi.js](https://github.com/djipco/webmidi) libraries to visualise and sonify US yield curve data. The sonification maps data to musical pitches. The notes themselves are output as note messages on MIDI channels 1 through 4

- Channel 1: main yield curve sonification (a Marimba in the video)
- Channel 2: annotation (peak inversion) sound trigger
- Channel 3: bass drum for month (CR78-style)
- Channel 4: incremental vocal samples for year mapped to midi notes

To actually hear a sound you need to establish a connection between Chrome and a valid MIDI-enabled sound source; to hear all tracks, you need a multi-timbral sound source. In my published project, I used Apple Logic Pro. But you could also use an in-browser solution such as [websynths.com](https://websynths.com/) - or connect to a hardware synthesizer using an appropriate MIDI interface.

## License

This software is published by the Financial Times under the [MIT licence](https://opensource.org/licenses/MIT).

Please note the MIT licence only covers the software, and does not cover any FT content or branding incorporated into the software or made available using the software. FT content is copyright © The Financial Times Limited, and FT and ‘Financial Times’ are trademarks of The Financial Times Limited, all rights reserved. For more information about republishing FT content, please contact our [republishing department](https://enterprise.ft.com/en-gb/services/republishing/).

