public with sharing class OrderChatController {

    @AuraEnabled(cacheable=true)
    public static List<DMS_Product__c> getAvailableProducts() {
        return [SELECT Id, Name, Unit_Price__c FROM DMS_Product__c];
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getAvailableProducts1() {
    // 1) code for Loading the metadata configuration
    List<DMS_Product_Field_Config__mdt> configs = [
        SELECT Field_API_Name__c, Display_Label__c, Sort_Order__c
        FROM DMS_Product_Field_Config__mdt
        WHERE Is_Active__c = true
          AND Object_API_Name__c = 'DMS_Product__c'
        ORDER BY Sort_Order__c ASC
    ];

    // 2) Build lists of API names and labels
    List<String> fieldApiNames = new List<String>();
    Map<String, String> fieldLabelMap = new Map<String, String>();
    for (DMS_Product_Field_Config__mdt cfg : configs) {
        fieldApiNames.add(cfg.Field_API_Name__c);
        fieldLabelMap.put(cfg.Field_API_Name__c, cfg.Display_Label__c);
    }

    // 3) Dynamically query those fields off DMS_Product__c
    String soql = 'SELECT Id';
    for (String f : fieldApiNames) {
        soql += ', ' + f;
    }
    soql += ' FROM DMS_Product__c LIMIT 100';
    List<SObject> records = Database.query(soql);

    // 4) Massage into simple maps for JSON
    List<Map<String, Object>> productList = new List<Map<String, Object>>();
    for (SObject rec : records) {
        Map<String, Object> row = new Map<String, Object>();
        for (String f : fieldApiNames) {
            row.put(f, rec.get(f));
        }
        // include the Id so JS can call addToCart
        row.put('Id', rec.get('Id'));
        productList.add(row);
    }

    // 5) Return fields, labels, and data
    return new Map<String, Object>{
        'fields'   => fieldApiNames,
        'labels'   => fieldLabelMap,
        'products' => productList
    };
    }

    @AuraEnabled(cacheable=true)
    public static List<DMS_Product__c> searchProducts(String keyword) {
    String searchKey = '%' + keyword.toLowerCase() + '%';
    return [
        SELECT Id, Name, Unit_Price__c, Quantity__c
        FROM DMS_Product__c
        WHERE Name != null AND
              Name LIKE :searchKey
    ];
}



    @AuraEnabled
    public static String addToCart(String contactId, String productId, Integer quantity) {
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
            SELECT DMS_Product_Name__r.Name, DMS_Product_Name__c, Quantity__c, Unit_Price__c, Final_Price__c 
            FROM Order_Line_Item__c 
            WHERE DMS_Order__c = :order.Id
        ];

        Decimal grandTotal = 0;
        List<Map<String, Object>> itemList = new List<Map<String, Object>>();
        for (Order_Line_Item__c item : items) {
            Map<String, Object> i = new Map<String, Object>();
            i.put('productName', item.DMS_Product_Name__r.Name);
            i.put('productId', item.DMS_Product_Name__c); // Add product ID
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
    // 1. Get the draft order for the contact
    List<DMS_Order__c> orders = [
        SELECT Id FROM DMS_Order__c
        WHERE Contact__c = :contactId AND Order_Status__c = 'Draft' LIMIT 1
    ];

    if (orders.isEmpty()) {
        return '⚠️ No active cart found.';
    }

    Id orderId = orders[0].Id;

    // 2. Find the order line item for this product
    List<Order_Line_Item__c> items = [
        SELECT Id, Quantity__c 
        FROM Order_Line_Item__c 
        WHERE DMS_Order__c = :orderId AND DMS_Product_Name__c = :productId
        LIMIT 1
    ];

    if (items.isEmpty()) {
        return '⚠️ Product not found in your cart.';
    }

    Order_Line_Item__c item = items[0];
    if (item.Quantity__c == 1) {
        delete item;
        return '🗑️ Product removed from cart.';
    } else {
        item.Quantity__c -= 1;
        update item;
        return '➖ Product quantity decreased.';
    }
}
}
