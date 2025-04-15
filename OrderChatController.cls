public with sharing class OrderChatController {
    
    @AuraEnabled(cacheable=true)
    public static List<DMS_Product__c> getAvailableProducts() {
        return [SELECT Id, Name, Unit_Price__c FROM DMS_Product__c];
    }

    @AuraEnabled
    public static String addToCart(String contactId, String productId) {
        Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = :contactId LIMIT 1];
        
        // Get or create a draft order
        DMS_Order__c order = getOrCreateDraftOrder(c.Id, c.AccountId);
        
        order.DMS_Product__c = productId;
        order.Quantity__c = (order.Quantity__c != null) ? order.Quantity__c + 1 : 1;
        update order;

        return 'Product added to cart';
    }

    private static DMS_Order__c getOrCreateDraftOrder(Id contactId, Id accountId) {
        List<DMS_Order__c> existing = [
            SELECT Id, Quantity__c, DMS_Product__c
            FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft' LIMIT 1
        ];
        if (!existing.isEmpty()) {
            return existing[0];
        }
        DMS_Order__c order = new DMS_Order__c(
            Contact__c = contactId,
            Account__c = accountId,
            Status__c = 'Draft'
        );
        insert order;
        return order;
    }

    @AuraEnabled
    public static Map<String, Object> getCart(String contactId) {
        List<DMS_Order__c> orders = [
            SELECT Id, Quantity__c, DMS_Product__r.Name, DMS_Product__r.Unit_Price__c
            FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft' LIMIT 1
        ];
        Map<String, Object> cart = new Map<String, Object>();
        if (!orders.isEmpty()) {
            DMS_Order__c order = orders[0];
            cart.put('productName', order.DMS_Product__r.Name);
            cart.put('quantity', order.Quantity__c);
            cart.put('price', order.DMS_Product__r.Unit_Price__c);
            cart.put('total', order.Quantity__c * order.DMS_Product__r.Unit_Price__c);
        }
        return cart;
    }

    @AuraEnabled
    public static String checkout(String contactId) {
        List<DMS_Order__c> orders = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft' LIMIT 1
        ];
        if (!orders.isEmpty()) {
            DMS_Order__c order = orders[0];
            order.Status__c = 'Submitted';
            update order;
            return 'Order submitted successfully. Order ID: ' + order.Id;
        }
        return 'No items in cart.';
    }

    @AuraEnabled
    public static String removeItem(String contactId) {
        List<DMS_Order__c> orders = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft' LIMIT 1
        ];
        if (!orders.isEmpty()) {
            delete orders[0];
            return 'Item removed from cart.';
        }
        return 'No item to remove.';
    }
}
