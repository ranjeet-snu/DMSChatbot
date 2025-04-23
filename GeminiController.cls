public with sharing class GeminiController {
    @AuraEnabled(cacheable=false)
    public static String getGeminiResponse(String userMessage) {
        String apiKey = 'AIzaSyCjWcphAipPVXg8V0RE3T9VKXv7rmrLCnk';
        String endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

        // Enhanced prompt with strict JSON formatting instructions
        String prompt = 'You are a shopping assistant. Return ONLY a JSON object with one of these exact structures: '
              + '{"action":"addToCart","product":"product_name","quantity":number}, '
              + '{"action":"removeFromCart","product":"product_name","quantity":number}, '
              + '{"action":"searchProducts","product":"product_name"}, '
              + '{"action":"showCart"}, '
              + '{"action":"checkout"}, '
              + '{"action":"help"}, '
              + '{"action":"showProducts"}, '
              + '{"action":"unknown"} '
              + 'RULES: '
              + '1. Use ONLY double quotes '
              + '2. No extra text outside JSON '
              + '3. "quantity" must be a number '
              + '4. Extract product names without brands '
              + '5. Default quantity for removal is 0 '
              + 'User message: "' + userMessage + '"';

        Http http = new Http();
        HttpRequest request = new HttpRequest();
        request.setEndpoint(endpoint);
        request.setMethod('POST');
        request.setHeader('Content-Type', 'application/json');

        // Build the request payload
        Map<String, Object> payload = new Map<String, Object>{
            'contents' => new List<Object>{
                new Map<String, Object>{
                    'parts' => new List<Object>{
                        new Map<String, Object>{'text' => prompt}
                    }
                }
            },
            'generationConfig' => new Map<String, Object>{
                'temperature' => 0.5 // Makes responses more deterministic
            }
        };

        request.setBody(JSON.serialize(payload));
        
        try {
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
                        String responseText = (String) part.get('text');
                        
                        // Clean and validate the JSON response
                        return validateAndCleanJson(responseText);
                    }
                }
            }
        } catch (Exception e) {
            System.debug('Error calling Gemini API: ' + e.getMessage());
        }
        
        return '{"action":"unknown"}';
    }
    
    private static String validateAndCleanJson(String rawResponse) {
        try {
            // Find the JSON portion in the response
            Integer jsonStart = rawResponse.indexOf('{');
            Integer jsonEnd = rawResponse.lastIndexOf('}') + 1;
            
            if (jsonStart == -1 || jsonEnd == 0 || jsonEnd <= jsonStart) {
                return '{"action":"unknown"}';
            }
            
            String jsonString = rawResponse.substring(jsonStart, jsonEnd);
            
            // Test parse to validate JSON structure
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(jsonString);
            
            // Validate required "action" field exists
            if (!parsed.containsKey('action')) {
                return '{"action":"unknown"}';
            }
            
            // Ensure quantity is a number if present
            if (parsed.containsKey('quantity')) {
                try {
                    // Convert to Integer to validate
                    Integer.valueOf(parsed.get('quantity'));
                } catch (Exception e) {
                    // If quantity isn't a number, remove it
                    parsed.remove('quantity');
                    jsonString = JSON.serialize(parsed);
                }
            }
            
            return jsonString;
        } catch (Exception e) {
            System.debug('JSON validation failed: ' + e.getMessage());
            return '{"action":"unknown"}';
        }
    }
}
