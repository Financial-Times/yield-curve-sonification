function scaleNotes (rootNote,scaleType,octStart,octRange){

    //handle case sensitivity
    scaleType = scaleType.toLowerCase();
    let a = rootNote[0].toUpperCase();
    if (rootNote[1]){
        const b = rootNote[1].toLowerCase();
        a = a+b;
    }
    rootNote = a;

    //convert flats to sharps for unambiguous note references
    //(music teachers of the world forgive me)
    switch(rootNote){
        case "Db":
            rootNote="C#";
            break;
        case "Eb":
            rootNote="D#";
            break;
        case "Gb":
            rootNote="F#";
            break;
        case "Ab":
            rootNote="G#";
            break;
        case "Bb":
            rootNote="A#";
            break;
    }

    //map out midi notes and named note equivalents
    const midiNotes = Array.from(Array(128).keys());
    const octaveNotes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
    const namedNotes = midiNotes.map(function(d,i){
        return octaveNotes[i % 12]+Math.floor(i/12);
    })

    //assign midi root note
    const rootIndex = octaveNotes.findIndex(function(value){return value == rootNote});

    //scale structures
    const scales = {
        major:{"notes":[0,2,4,5,7,9,11]},
        minor:{"notes":[0,2,3,5,7,8,10]},
        minorharmonic:{"notes":[0,2,3,5,7,8,11]},
        minormelodic:{"notes":[0,2,3,5,7,9,11]},
        wholetone:{"notes":[0,2,4,6,8,10]},
        semitone:{"notes":[0,1,2,3,4,5,6,7,8,9,10,11]}
    }

    //create array of output notes
    const outputNotes = [];
    for (i = 0; i< octRange; i++){
        scales[scaleType].notes.forEach(function(d,j){
            outputNotes.push(namedNotes[((octStart+i)*12)+(rootIndex+d)]);
        })
    }

    return outputNotes;
}