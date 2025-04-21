import { LightningElement, api, track } from 'lwc';
import getAvailableProducts from '@salesforce/apex/OrderChatController.getAvailableProducts';
import getAvailableProducts1 from '@salesforce/apex/OrderChatController.getAvailableProducts1';
import searchProducts from '@salesforce/apex/OrderChatController.searchProducts';
import addToCart from '@salesforce/apex/OrderChatController.addToCart';
import getCart from '@salesforce/apex/OrderChatController.getCart';
import checkout from '@salesforce/apex/OrderChatController.checkout';
import removeItem from '@salesforce/apex/OrderChatController.removeItem';
import botAvatar from '@salesforce/resourceUrl/botAvatar';
import userAvatar from '@salesforce/resourceUrl/userAvatar';
import chatbotLogo from '@salesforce/resourceUrl/chatbotLogo';
import getGeminiResponse from '@salesforce/apex/GeminiController.getGeminiResponse';

export default class ChatBotContainer extends LightningElement {
    @api recordId;
    @track messages = [];
    @track inputText = '';
    @track isOpen = false;
    @track isFullscreen = false;
    @track isBotTyping = false;
    @track showQuickReplies = false;
    @track quickReplies = [];

    botAvatar = botAvatar;
    userAvatar = userAvatar;
    chatbotLogo = chatbotLogo;

    defaultQuickReplies = [
        { id: 1, text: 'show products' },
        { id: 2, text: 'show cart' },
        { id: 3, text: 'checkout' },
        { id: 4, text: 'need Help' }
    ];

    connectedCallback() {
        this.addBotMessage('Welcome to the DMS Ordering Assistant! How can I help you today?', this.defaultQuickReplies);
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.isFullscreen = false;
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
    }

    get fullscreenIcon() {
        return this.isFullscreen ? 'utility:contract_alt' : 'utility:expand_alt';
    }

    get chatContainerClass() {
        let classes = 'chat-container';
        if (this.isOpen) classes += ' open';
        if (this.isFullscreen) classes += ' fullscreen';
        return classes;
    }

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

    addBotMessage(text, quickReplies = null, isHtml = false) {
        this.messages = [...this.messages, {
            id: Date.now(),
            text: text,
            isHtml: isHtml,
            containerClass: 'message-container bot',
            bubbleClass: 'message-bubble bot',
            avatar: this.botAvatar,
            senderAlt: 'Assistant',
            timestamp: this.getCurrentTime()
        }];
        if (quickReplies !== null) {
            this.quickReplies = quickReplies;
            this.showQuickReplies = quickReplies.length > 0;
        }
        this.scrollToBottom();
    }

    handleInput(event) {
        this.inputText = event.detail.value;
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleSend();
        }
    }

    handleSend() {
        const msg = this.inputText.trim();
        if (!msg) return;
        this.addUserMessage(msg);
        this.processInput(msg);
        this.inputText = '';
    }

    async processInput(input) {
        this.isBotTyping = true; 
        
        try {
            // First get the intent from Gemini
            const geminiResponse = await getGeminiResponse({ userMessage: input });
            console.log('Gemini response:', geminiResponse);
            
            // Parse the JSON response
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(geminiResponse);
                console.log('Parsed Gemini response:', parsedResponse);
                
            } catch (e) {
                console.error('Error parsing Gemini response:', e);
                parsedResponse = { action: 'unknown' };
            }
            
            // Handle the action based on Gemini's response
            switch(parsedResponse.action) {
                case 'addToCart':
                    await this.handleAddToCart(parsedResponse.product, parsedResponse.quantity || 1);
                    console.log("addTocart from known Input");
                    break;
                    
                case 'removeFromCart':
                    await this.handleRemoveFromCart(parsedResponse.product);
                    break;

                case 'searchProducts':
                    await this.handleSearchProducts(parsedResponse.query);
                    break;
                    
                case 'showCart':
                    await this.handleShowCart();
                    break;

        
                    
                case 'checkout':
                    await this.handleCheckout();
                    break;
                    
                case 'help':
                    this.handleHelp();
                    console.log("help from known Input");
                    break;
                    
                case 'showProducts':
                    await this.handleShowProducts();
                    break;
                    
                case 'unknown':
                default:
                    this.handleUnknownInput(input);
                    break;
            }
        } catch (error) {
            console.error('Error processing input:', error);
            this.isBotTyping = false;
            this.addBotMessage("⚠️ Sorry, I encountered an error. Please try again.", null);
        }
    }

    // Action handlers
    async handleAddToCart(productName, quantity = 1) {
        const products = await getAvailableProducts();
        const match = products.find(p => p.Name.toLowerCase() === productName.toLowerCase());
        
        if (match) {
            await addToCart({ 
                contactId: this.recordId, 
                productId: match.Id,
                quantity: quantity
            });
            this.addBotMessage(`✅ ${match.Name} (${quantity}) added to cart.`, null);
        } else {
            this.addBotMessage(`❌ Product "${productName}" not found.`, null);
        }
        this.isBotTyping = false;
    }

    async handleRemoveFromCart(productName) {
        const cartData = await getCart({ contactId: this.recordId });
        const item = cartData.items.find(i => i.productName.toLowerCase() === productName.toLowerCase());
        
        if (item) {
            const res = await removeItem({ 
                contactId: this.recordId,
                productId: item.productId
            });
            this.addBotMessage(`✅ ${item.productName} removed from cart.`, null);
        } else {
            this.addBotMessage(`❌ Product "${productName}" not found in cart.`, null);
        }
        this.isBotTyping = false;
    }

    async handleSearchProducts(query) {
        this.isBotTyping = true;
        const products = await searchProducts({ keyword: query });
        
        if (products.length > 0) {
            let tableHtml = `<table style="width:100%; border-collapse: collapse; font-size:14px;">
                <thead><tr>
                    <th style="padding:6px;border-bottom:1px solid #ccc;">Name</th>
                    <th style="padding:6px;border-bottom:1px solid #ccc;">Price</th>
                    <th style="padding:6px;border-bottom:1px solid #ccc;">Stock</th>
                </tr></thead><tbody>`;
            
            products.forEach(prod => {
                tableHtml += `<tr>
                    <td style="padding:6px;border-bottom:1px solid #eee;">${prod.Name}</td>
                    <td style="padding:6px;border-bottom:1px solid #eee;">₹${prod.Unit_Price__c}</td>
                    <td style="padding:6px;border-bottom:1px solid #eee;">${prod.Quantity__c ?? 0}</td>
                </tr>`;
            });
            
            tableHtml += `</tbody></table>`;
            this.addBotMessage(tableHtml, null, true);
        } else {
            this.addBotMessage(`No products found matching "${query}". Try different keywords.`);
        }
        
        this.isBotTyping = false;
    }

    async handleShowCart() {
        const cartData = await getCart({ contactId: this.recordId });

        if (cartData && cartData.items && cartData.items.length > 0) {
            let cartHtml = `
                <div style="margin-top:10px;">
                <table style="width:100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Item</th>
                            <th style="padding: 6px; border-bottom: 1px solid #ccc;">Price</th>
                            <th style="padding: 6px; border-bottom: 1px solid #ccc;">Qty</th>
                            <th style="padding: 6px; border-bottom: 1px solid #ccc;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            cartData.items.forEach(item => {
                cartHtml += `
                    <tr>
                        <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.productName}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #eee;">₹${item.unitPrice}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #eee;">₹${item.total}</td>
                    </tr>
                `;
            });

            cartHtml += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="text-align:right; padding: 6px;"><strong>Grand Total:</strong></td>
                            <td style="padding: 6px;"><strong>₹${cartData.grandTotal}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                </div>
            `;

            this.addBotMessage(cartHtml, null, true);
        } else {
            this.addBotMessage('🛒 Your cart is empty.', null);
        }
        this.isBotTyping = false;
    }

    async handleCheckout() {
        const res = await checkout({ contactId: this.recordId });
        this.addBotMessage(res, null);
        this.isBotTyping = false;
    }

    

    handleHelp() {
        this.addBotMessage(
            "I can help you with:\n" +
            "- Adding products to cart (e.g., 'add 2 shirts')\n" +
            "- Removing products (e.g., 'remove shirts')\n" +
            "- Viewing your cart (e.g., 'show my cart')\n" +
            "- Checking out (e.g., 'checkout')\n" +
            "- Searching products (e.g., 'search shirts')",
            this.defaultQuickReplies
        );
        this.isBotTyping = false;
    }

    async handleShowProducts() {
        const result = await getAvailableProducts1();
        const fields = result.fields;
        const labels = result.labels;
        const products = result.products;

        let tableHtml = `<table style="width:100%; border-collapse: collapse; font-size:14px;">`;
        tableHtml += `<thead><tr>`;
        fields.forEach(f => {
            tableHtml += `<th style="padding:6px;border-bottom:1px solid #ccc;">${labels[f]}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        products.forEach(prod => {
            tableHtml += `<tr>`;
            fields.forEach(f => {
                tableHtml += `<td style="padding:6px;border-bottom:1px solid #eee;">${prod[f] ?? ''}</td>`;
            });
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table>`;

        this.addBotMessage(tableHtml, null, true);
        this.isBotTyping = false;
    }

    handleUnknownInput(input) {
        // Try to handle some common cases that Gemini might have missed
        if (input.toLowerCase().includes('product') || input.toLowerCase().includes('item')) {
            this.handleShowProducts();
        } else if (input.toLowerCase().includes('cart') || input.toLowerCase().includes('basket')) {
            this.handleShowCart();
        } else if (input.toLowerCase().includes('checkout') || input.toLowerCase().includes('buy')) {
            this.handleCheckout();
        } else if (input.toLowerCase().includes('help')) {
            console.log("help from Unknown Input");
            this.handleHelp();
        } else {
            this.addBotMessage("🤖 Sorry, I didn't understand that. Type 'help' to see what I can do.", null);
            this.isBotTyping = false;
        }
    }

    handleQuickReply(event) {
        const replyText = event.target.label;
        this.inputText = replyText;
        this.handleSend();
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.template.querySelector('.chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 0);
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    renderedCallback() {
        const htmlMessages = this.template.querySelectorAll('.html-message');
        htmlMessages.forEach(div => {
            const msgId = Number(div.dataset.id);
            const msg = this.messages.find(m => m.id === msgId);
            if (msg && msg.isHtml) {
                div.innerHTML = msg.text;
            }
        });
    }
}
