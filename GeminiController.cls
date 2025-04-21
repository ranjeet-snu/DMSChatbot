public with sharing class GeminiController {
    @AuraEnabled(cacheable=false)
    public static String getGeminiResponse(String userMessage) {
        String apiKey = 'AIzaSyCjWcphAipPVXg8V0RE3T9VKXv7rmrLCnk';
        String endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;


        String prompt = 'You are a smart assistant for a shopping chatbot. Extract the intent and return a JSON in the format:\n' +
                        '{ "action": "<action>", "product": "<product_name>", "quantity": <quantity> }\n' +
                        'Recognized actions: "addToCart", "removeFromCart", "showCart", "checkout", "help".\n' +
                        'If no valid action is detected, respond with {"action": "unknown"}.\n' +
                        'User message: "' + userMessage + '"';

        Http http = new Http();
        HttpRequest request = new HttpRequest();
        request.setEndpoint(endpoint);
        request.setMethod('POST');
        request.setHeader('Content-Type', 'application/json');

        Map<String, Object> payload = new Map<String, Object>{
            'contents' => new List<Object>{
                new Map<String, Object>{
                    'parts' => new List<Object>{
                        new Map<String, Object>{'text' => prompt}
                    }
                }
            }
        };

        request.setBody(JSON.serialize(payload));
        HttpResponse response = http.send(request);

        if (response.getStatusCode() == 200) {
            Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
            List<Object> candidates = (List<Object>) responseMap.get('candidates');
            if (!candidates.isEmpty()) {
                Map<String, Object> candidate = (Map<String, Object>) candidates[0];
                Map<String, Object> content = (Map<String, Object>) candidate.get('content');
                List<Object> parts = (List<Object>) content.get('parts');
                if (!parts.isEmpty()) {
                    Map<String, Object> part = (Map<String, Object>) parts[0];
                    return (String) part.get('text');
                }
            }
        }

        return '{"action": "unknown"}';
    }
}

;; String userMessage = 'SHOW ME MY CART'; // You can change this message to any input.
;; String response = GeminiController.getGeminiResponse(userMessage);
;; System.debug('Gemini Response: ' + response);
