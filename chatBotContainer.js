import { LightningElement, api, track } from 'lwc';
import getAvailableProducts from '@salesforce/apex/OrderChatController.getAvailableProducts';
import addToCart from '@salesforce/apex/OrderChatController.addToCart';
import getCart from '@salesforce/apex/OrderChatController.getCart';
import checkout from '@salesforce/apex/OrderChatController.checkout';
import removeItem from '@salesforce/apex/OrderChatController.removeItem';
import botAvatar from '@salesforce/resourceUrl/botAvatar';
import userAvatar from '@salesforce/resourceUrl/userAvatar';
import chatbotLogo from '@salesforce/resourceUrl/chatbotLogo';

export default class ChatBotContainer extends LightningElement {
    // Original Logic
    @api recordId;
    @track messages = [];
    @track inputText = '';
    @track cart = null;

    // UI State
    @track isOpen = false;
    @track isFullscreen = false;
    @track isBotTyping = false;
    @track showQuickReplies = false;
    @track quickReplies = [];
    
    // Images
    botAvatar = botAvatar;
    userAvatar = userAvatar;
    chatbotLogo = chatbotLogo;

    // Initialize chat
    connectedCallback() {
        this.addBotMessage('👋 Hello! Type "show products", "add [product]", "show cart", "remove", or "checkout".', [
            { id: 1, text: 'show products' },
            { id: 2, text: 'show cart' }
        ]);
    }

    // Toggle chat visibility
    toggleChat() {
        this.isOpen = !this.isOpen;
        this.isFullscreen = false; // Reset fullscreen when toggling
    }

    // Toggle fullscreen mode
    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
    }


    get fullscreenIcon() {
        return this.isFullscreen ? 'utility:contract_alt' : 'utility:expand_alt';
    }

    // Getter for chat container classes
    get chatContainerClass() {
        let classes = 'chat-container';
        if (this.isOpen) classes += ' open';
        if (this.isFullscreen) classes += ' fullscreen';
        return classes;
    }

    // Add user message
    addUserMessage(text) {
        this.messages = [...this.messages, {
            id: Date.now(),
            text: text,
            containerClass: 'message-container user',
            bubbleClass: 'message-bubble user',
            avatar: this.userAvatar,
            senderAlt: 'You',
            timestamp: this.getCurrentTime()
        }];
        this.scrollToBottom();
    }

    // Add bot message
    addBotMessage(text, quickReplies = []) {
        this.messages = [...this.messages, {
            id: Date.now(),
            text: text,
            containerClass: 'message-container bot',
            bubbleClass: 'message-bubble bot',
            avatar: this.botAvatar,
            senderAlt: 'Assistant',
            timestamp: this.getCurrentTime()
        }];
        
        this.quickReplies = quickReplies;
        this.showQuickReplies = quickReplies.length > 0;
        this.scrollToBottom();
    }

    // Handle input
    handleInput(event) {
        this.inputText = event.detail.value;
    }

    // Handle send
    handleSend() {
        const msg = this.inputText.trim();
        if (!msg) return;

        this.addUserMessage(msg);
        this.processInput(msg.toLowerCase());
        this.inputText = '';
    }

    // Process input
    async processInput(input) {
        if (input === 'show products') {
            this.isBotTyping = true;
            const products = await getAvailableProducts();
            let response = 'Available Products:\n';
            products.forEach(p => {
                response += `- ${p.Name} - ₹${p.Unit_Price__c}\n`;
            });
            this.isBotTyping = false;
            this.addBotMessage(response);
        } 
        else if (input.startsWith('add ')) {
            this.isBotTyping = true;
            const name = input.replace('add ', '').trim().toLowerCase();
            const products = await getAvailableProducts();
            const match = products.find(p => p.Name.toLowerCase() === name);
            
            if (match) {
                await addToCart({ contactId: this.recordId, productId: match.Id });
                this.isBotTyping = false;
                this.addBotMessage(`✅ ${match.Name} added to cart.`);
                this.loadCart();
            } else {
                this.isBotTyping = false;
                this.addBotMessage(`❌ Product not found.`);
            }
        }
        else if (input === 'show cart') {
            this.isBotTyping = true;
            await this.loadCart();
            this.isBotTyping = false;
            this.addBotMessage('🛒 Cart details shown.');
        }
        else if (input === 'remove') {
            this.isBotTyping = true;
            const res = await removeItem({ contactId: this.recordId });
            this.isBotTyping = false;
            this.addBotMessage(res);
            this.cart = null;
        }
        else if (input === 'checkout') {
            this.isBotTyping = true;
            const res = await checkout({ contactId: this.recordId });
            this.isBotTyping = false;
            this.cart = null;
            this.addBotMessage(res);
        }
        else {
            this.isBotTyping = true;
            setTimeout(() => {
                this.isBotTyping = false;
                this.addBotMessage("🤖 Sorry, I didn't understand that.");
            }, 1000);
        }
    }

    // Load cart
    async loadCart() {
        const cartData = await getCart({ contactId: this.recordId });
        if (cartData && cartData.productName) {
            this.cart = cartData;
        } else {
            this.cart = null;
            this.addBotMessage('🛒 Your cart is empty.');
        }
    }

    // Handle quick reply
    handleQuickReply(event) {
        const replyText = event.target.label;
        this.inputText = replyText;
        this.handleSend();
    }

    // Scroll to bottom
    scrollToBottom() {
        setTimeout(() => {
            const container = this.template.querySelector('.chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 0);
    }

    // Get current time
    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}