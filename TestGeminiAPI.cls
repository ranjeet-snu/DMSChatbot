public with sharing class TestGeminiAPI {

    @AuraEnabled
    public static String testGemini() {
        // Replace with your Gemini API key
        String apiKey = 'AIzaSyCjWcphAipPVXg8V0RE3T9VKXv7rmrLCnk';
        String endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

        // Constructing payload as per Gemini's requirement:
        // {
        //   "contents": [
        //     {
        //       "parts": [{"text": "Explain how AI works"}]
        //     }
        //   ]
        // }
        Map<String, Object> part = new Map<String, Object>();
        part.put('text', 'Explain how AI works');

        List<Object> partsList = new List<Object>();
        partsList.add(part);

        Map<String, Object> contentItem = new Map<String, Object>();
        contentItem.put('parts', partsList);

        List<Object> contents = new List<Object>();
        contents.add(contentItem);

        Map<String, Object> payload = new Map<String, Object>();
        payload.put('contents', contents);

        // Create HTTP request
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(payload));

        Http http = new Http();
        HttpResponse res = http.send(req);

        // Parse response
        if (res.getStatusCode() == 200) {
            Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> candidates = (List<Object>) result.get('candidates');
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> top = (Map<String, Object>) candidates[0];
                Map<String, Object> msg = (Map<String, Object>) top.get('content');
                List<Object> parts = (List<Object>) msg.get('parts');
                if (parts != null && !parts.isEmpty()) {
                    Map<String, Object> partResp = (Map<String, Object>) parts[0];
                    return 'Gemini Response: ' + (String) partResp.get('text');
                }
            }



//System.debug(TestGeminiAPI.testGemini());       to run check
        }

        return 'Gemini API Error: ' + res.getStatusCode() + ' - ' + res.getBody();
    }
}
