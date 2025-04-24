import { LightningElement, track } from 'lwc';

export default class VoiceInputApp extends LightningElement {
    @track input = '';
    isListening = false;
    recognition;

    connectedCallback() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = navigator.language || 'en-US';

            this.recognition.onresult = (event) => {
                this.input = event.results[0][0].transcript;
            };

            this.recognition.onend = () => {
                this.isListening = false; // Reset when recognition ends
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;
            };
        } else {
            console.warn('SpeechRecognition not supported in this browser.');
        }
    }

    toggleMic() {
        if (!this.recognition) return;

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        } else {
            this.recognition.start();
            this.isListening = true;
        }
    }

    get micIcon() {
        return this.isListening ? '🔴' : '🎤';
    }

    get micButtonClass() {
        return this.isListening ? 'mic-button active' : 'mic-button';
    }
}
