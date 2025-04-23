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
        this.addBotMessage(
            `<div>
                <strong>👋 Hey there! Welcome to our ChatBot 😊</strong><br><br>
                You can get started by clicking or typing any of the options below:
                <ul>
                    <li>👉 <strong>Show Products</strong> – to browse our products</li>
                    <li>🛒 <strong>Show Cart</strong> – to see what you've added</li>
                    <li>✅ <strong>Checkout</strong> – to place your order</li>
                    <li>❓ <strong>Need Help</strong> – if you're unsure what to do next</li>
                </ul>
                <p><strong>✍️ Tip:</strong> You can also type commands directly!</p>
                <ul>
                    <li>➕ <strong>Add [product name]</strong> — to add an item to your cart</li>
                    <li>❌ <strong>Remove [product name]</strong> — to remove an item from your cart</li>
                </ul>
            </div>`,
            this.defaultQuickReplies,
            true
        );
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
        this.processInput(msg.toLowerCase());
        this.inputText = '';
    }

    async processInput(input) {
        if (input === 'show products') {
            this.isBotTyping = true;

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

            this.isBotTyping = false;
            this.addBotMessage(tableHtml, null, true); // Keep quick replies
        }

        else if (input.startsWith('add ')) {
            this.isBotTyping = true;
            const inputParts = input.replace('add ', '').trim().split(/\s+/);
            
            let quantity = 1; // Default quantity
            let unit = '';    // Default unit (empty if not specified)
            let name;
            
            // Check if the first part contains a number (like "5kg" or "2L")
            const quantityUnitMatch = inputParts[0].match(/(\d+)(\D*)/);
            
            if (quantityUnitMatch) {
                quantity = parseInt(quantityUnitMatch[1], 10);
                unit = quantityUnitMatch[2].trim(); // Get the unit part (kg, L, etc.)
                
                // If there's more parts after the quantity+unit, use them as name
                name = inputParts.slice(1).join(' ').toLowerCase();
                
                // If no name parts after quantity+unit, maybe quantity+unit was combined with name (like "5kgatta")
                if (!name && inputParts[0].length > quantityUnitMatch[0].length) {
                    name = inputParts[0].substring(quantityUnitMatch[0].length) + 
                          (inputParts.slice(1).join(' ') || '');
                }
            } else {
                // No quantity found, use the entire input as product name
                name = inputParts.join(' ').toLowerCase();
            }
            
            console.log('quantity', quantity);
            console.log('unit', unit);
            console.log('name', name);
            
            const products = await getAvailableProducts();
            const match = products.find(p => p.Name.toLowerCase() === name);
            
            if (match) {
                await addToCart({ 
                    contactId: this.recordId, 
                    productId: match.Id,
                    quantity: quantity
                });
                this.isBotTyping = false;
                
                // Create the display message with unit if it exists
                const quantityDisplay = unit ? `${quantity}${unit}` : quantity;
                this.addBotMessage(`✅ ${quantityDisplay} ${match.Name} added to cart.`, null);
            } else {
                this.isBotTyping = false;
                this.addBotMessage(`❌ Product "${name}" not found.`, null);
            }
        }

        else if (input === 'show cart') {
            this.isBotTyping = true;
            const cartData = await getCart({ contactId: this.recordId });
            this.isBotTyping = false;

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

                this.addBotMessage(cartHtml, null, true); // Preserve quick replies
            } else {
                this.addBotMessage('🛒 Your cart is empty.', null);
            }
        }

        

        else if (input.startsWith('remove ')) {
            this.isBotTyping = true;
            const productName = input.replace('remove ', '').trim().toLowerCase();
            
            try {
                // Get all available products to find the ID
                const products = await getAvailableProducts();
                const product = products.find(p => p.Name.toLowerCase() === productName);
                
                if (product) {
                    const result = await removeItem({
                        contactId: this.recordId,
                        productId: product.Id
                    });
                    
                    if (result.includes('removed')) {
                        this.addBotMessage(`✅ ${product.Name} removed from cart.`, null);
                    } else {
                        this.addBotMessage(`❌ ${result}`, null);
                    }
                } else {
                    this.addBotMessage(`❌ Product "${productName}" not found.`, null);
                }
            } catch (error) {
                this.addBotMessage(`❌ Error removing item: ${error.body?.message || error.message}`, null);
            }
            
            this.isBotTyping = false;
        }


        else if (input.startsWith('search ')) {
            this.isBotTyping = true;
            const keyword = input.replace('search ', '').trim().toLowerCase();
            console.log('keyword', keyword);
            const products = await searchProducts({ keyword });
        
            if (products.length > 0) {
                let tableHtml = `<table style="width:100%; border-collapse: collapse; font-size:14px;">`;
                tableHtml += `<thead><tr>
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
                this.addBotMessage(`❌ No products found matching "${keyword}".`);
            }
        
            this.isBotTyping = false;
        }

        else if (input.startsWith('need help')) {
            this.isBotTyping = true;
            this.addBotMessage("📢 LLM has not been integrated yet in our chatbot. We are working on this — once it is integrated, I will be able to help more with order-related issues through the chatbot.");
            this.isBotTyping = false;
        }
        
        else if (input === 'checkout') {
            this.isBotTyping = true;
            const res = await checkout({ contactId: this.recordId });
            this.isBotTyping = false;
            this.addBotMessage(res);
        }

        else {
            this.isBotTyping = true;
            setTimeout(() => {
                this.isBotTyping = false;
                this.addBotMessage("🤖 Sorry, I didn't understand that.", null);
            }, 1000);
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
