public with sharing class OrderChatController {

    @AuraEnabled(cacheable=true)
    public static List<DMS_Product__c> getAvailableProducts() {
        return [SELECT Id, Name, Unit_Price__c FROM DMS_Product__c];
    }

    @AuraEnabled
    public static String addToCart(String contactId, String productId) {
        Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = :contactId LIMIT 1];

        DMS_Order__c order = getOrCreateDraftOrder(c.Id, c.AccountId);

        List<Order_Line_Item__c> existingItems = [
            SELECT Id, Quantity__c 
            FROM Order_Line_Item__c 
            WHERE DMS_Order__c = :order.Id AND DMS_Product_Name__c = :productId
        ];

        if (!existingItems.isEmpty()) {
            Order_Line_Item__c item = existingItems[0];
            item.Quantity__c += 1;
            update item;
        } else {
            DMS_Product__c product = [SELECT Id, Unit_Price__c FROM DMS_Product__c WHERE Id = :productId LIMIT 1];
            Order_Line_Item__c newItem = new Order_Line_Item__c(
                DMS_Order__c = order.Id,
                DMS_Product_Name__c = product.Id,
                Quantity__c = 1,
                Unit_Price__c = product.Unit_Price__c,
                Final_Price__c = product.Unit_Price__c // you can later apply discounts if needed
            );
            insert newItem;
        }

        return 'Product added to cart';
    }

    private static DMS_Order__c getOrCreateDraftOrder(Id contactId, Id accountId) {
        List<DMS_Order__c> existing = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Order_Status__c = 'Draft' LIMIT 1
        ];
        if (!existing.isEmpty()) {
            return existing[0];
        }
        DMS_Order__c order = new DMS_Order__c(
            Contact__c = contactId,
            Account__c = accountId,
            Order_Status__c = 'Draft'
        );
        insert order;
        return order;
    }

    @AuraEnabled
    public static Map<String, Object> getCart(String contactId) {
        List<DMS_Order__c> orders = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Order_Status__c = 'Draft' LIMIT 1
        ];
        Map<String, Object> cart = new Map<String, Object>();
        if (!orders.isEmpty()) {
            DMS_Order__c order = orders[0];
            List<Order_Line_Item__c> items = [
                SELECT DMS_Product_Name__r.Name, Quantity__c, Unit_Price__c, Final_Price__c 
                FROM Order_Line_Item__c 
                WHERE DMS_Order__c = :order.Id
            ];

            Decimal grandTotal = 0;
            List<Map<String, Object>> itemList = new List<Map<String, Object>>();
            for (Order_Line_Item__c item : items) {
                Map<String, Object> i = new Map<String, Object>();
                i.put('productName', item.DMS_Product_Name__r.Name);
                i.put('quantity', item.Quantity__c);
                i.put('unitPrice', item.Unit_Price__c);
                i.put('total', item.Quantity__c*item.Final_Price__c);
                itemList.add(i);
                grandTotal += item.Quantity__c*item.Final_Price__c;
            }

            cart.put('items', itemList);
            cart.put('grandTotal', grandTotal);
        }
        return cart;
    }

    @AuraEnabled
public static String checkout(Id contactId) {
    List<DMS_Order__c> orders = [
        SELECT Id, Name FROM DMS_Order__c 
        WHERE Contact__c = :contactId 
        AND Order_Status__c = 'Draft' LIMIT 1
    ];

    if (!orders.isEmpty()) {
        DMS_Order__c order = orders[0];
        order.Order_Status__c = 'Submitted';
        update order;

        return '✅ Order submitted successfully. Order: ' + order.Name;
    } else {
        return '⚠️ No active order to submit.';
    }
}


    @AuraEnabled
    public static String removeItem(String contactId, String productId) {
        List<DMS_Order__c> orders = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Order_Status__c = 'Draft' LIMIT 1
        ];
        if (!orders.isEmpty()) {
            DMS_Order__c order = orders[0];
            List<Order_Line_Item__c> itemsToRemove = [
                SELECT Id FROM Order_Line_Item__c
                WHERE DMS_Order__c = :order.Id AND DMS_Product_Name__c = :productId
            ];
            if (!itemsToRemove.isEmpty()) {
                delete itemsToRemove;
                return 'Item removed from cart.';
            }
        }
        return 'No item to remove.';
    }
}
