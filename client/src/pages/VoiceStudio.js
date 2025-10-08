import React, { useState } from "react";
import { SpeakerWaveIcon, PlayIcon, BoltIcon } from "@heroicons/react/24/outline";

const VoiceStudio = () => {
    const [selectedVoice, setSelectedVoice] = useState("professional-sarah");

    const voices = [{
            id: "professional-sarah",
            name: "Professional Sarah",
            accent: "American Accent",
            tone: "Formal",
            emotionRange: 75,
            emotionLevel: "Moderate",
            isSelected: true
        },
        {
            id: "empathetic-priya",
            name: "Empathetic Priya",
            accent: "Indian Accent",
            tone: "Warm",
            emotionRange: 100,
            emotionLevel: "High",
            isSelected: false
        }
    ];

    return ( <
        div className = "space-y-6" >
        <
        div className = "flex items-center justify-between" >
        <
        div >
        <
        h1 className = "text-2xl font-bold text-gray-900" > Voice Studio < /h1> <
        /div> <
        button className = "flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700" >
        <
        BoltIcon className = "h-4 w-4 mr-2" / >
        Clone Custom Voice <
        /button> <
        /div>

        { /* AI Voice with Personality Banner */ } <
        div className = "bg-purple-50 rounded-lg p-6" >
        <
        div className = "flex items-start" >
        <
        SpeakerWaveIcon className = "h-8 w-8 text-purple-600 mr-4 mt-1" / >
        <
        div >
        <
        h3 className = "text-lg font-semibold text-gray-900 mb-2" > AI Voice with Personality < /h3> <
        p className = "text-gray-700" >
        Build AI voices that reflect your brand identity and convey emotion.Move beyond robotic voices with dynamic tone adjustment and real - time emotion response. <
        /p> <
        /div> <
        /div> <
        /div>

        { /* Voice Configuration Cards */ } <
        div className = "grid grid-cols-1 md:grid-cols-2 gap-6" > {
            voices.map((voice) => ( <
                div key = { voice.id }
                className = { `bg-white rounded-lg shadow-sm p-6 border-2 transition-all duration-200 ${
                            selectedVoice === voice.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-gray-300'
                        }` } >
                <
                div className = "flex items-start justify-between mb-4" >
                <
                div className = "flex items-center" >
                <
                SpeakerWaveIcon className = "h-8 w-8 text-purple-600 mr-3" / >
                <
                div >
                <
                h3 className = "text-lg font-semibold text-gray-900" > { voice.name } < /h3> <
                p className = "text-sm text-gray-500" > { voice.accent } < /p> <
                /div> <
                /div> {
                    selectedVoice === voice.id && ( <
                        div className = "w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center" >
                        <
                        svg className = "h-4 w-4 text-white"
                        fill = "currentColor"
                        viewBox = "0 0 20 20" >
                        <
                        path fillRule = "evenodd"
                        d = "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule = "evenodd" / >
                        <
                        /svg> <
                        /div>
                    )
                } <
                /div>

                <
                div className = "space-y-4" >
                <
                div >
                <
                label className = "text-sm font-medium text-gray-700" > Tone < /label> <
                p className = "text-lg text-gray-900" > { voice.tone } < /p> <
                /div>

                <
                div >
                <
                label className = "text-sm font-medium text-gray-700" > Emotion Range < /label> <
                div className = "mt-2" >
                <
                div className = "flex items-center justify-between text-sm text-gray-600 mb-1" >
                <
                span > Emotion Range < /span> <
                span > { voice.emotionLevel } < /span> <
                /div> <
                div className = "w-full bg-gray-200 rounded-full h-2" >
                <
                div className = "bg-purple-600 h-2 rounded-full"
                style = {
                    { width: `${voice.emotionRange}%` } } >
                < /div> <
                /div> <
                /div> <
                /div>

                <
                button onClick = {
                    () => setSelectedVoice(voice.id) }
                className = "w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors" >
                <
                PlayIcon className = "h-4 w-4 mr-2" / >
                Preview Voice <
                /button> <
                /div> <
                /div>
            ))
        } <
        /div> <
        /div>
    );
};

export default VoiceStudio;