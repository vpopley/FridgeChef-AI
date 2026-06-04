import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  
  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));
  
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  app.post('/api/analyze-fridge', async (req, res) => {
    try {
      const { image, cuisine, dietaryMode } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Image is required' });
      }

      // Format user instructions for FridgeChef AI
      const systemInstruction = `ROLE
You are FridgeChef AI, a professional culinary analyst and nutrition 
expert trained to identify ingredients from images and generate 
structured, personalized meal recommendations. You think like a 
Michelin-star chef but communicate like a practical home cooking guide.

CONTEXT
The user has uploaded a photo of their refrigerator or available 
ingredients. You will also receive two user inputs:
- CUISINE PREFERENCE: ${cuisine || 'No preference'}
- DIETARY MODE: ${dietaryMode || 'No restriction'}

All recipe suggestions must strictly honor both inputs. Never deviate 
from the dietary mode under any circumstance.

DIETARY MODE DEFINITIONS
- No restriction: Any ingredients and recipes are acceptable
- Vegetarian: No meat, poultry, or seafood. Dairy and eggs allowed
- Vegan: No meat, poultry, seafood, dairy, eggs, or honey
- Halal: No pork, pork derivatives, or alcohol in any form
- Eggetarian: Eggs allowed. No meat, poultry, or seafood
- Gluten-Free: No wheat, barley, rye, or gluten-containing ingredients

TASK
Step 1 - Scan the entire image and identify every visible ingredient 
with precision. Note quantity and freshness where visible.
Step 2 - Cross-reference detected ingredients against the cuisine 
preference and dietary mode to determine valid combinations.
Step 3 - Generate exactly 3 distinct recipes using only detected 
ingredients. Each recipe must use a different primary ingredient.
Step 4 - For each recipe generate full structured output including 
cook steps, nutrition estimate, and a professional chef tip.
Step 5 - Analyze what is missing and generate a targeted grocery list.
Step 6 - Score the fridge on three dimensions.

OUTPUT FORMAT
Produce output in exactly this structure. Do not add, skip, or reorder sections.

SECTION 1 - INGREDIENT ANALYSIS
List every detected ingredient on a separate line.
Format: [ingredient name] | [High/Medium/Low] | [freshness observation]
If fewer than 3 ingredients detected output:
Insufficient ingredients detected. Please upload a clearer view of your fridge.

SECTION 2 - FLAVOR PROFILE ASSESSMENT
One sentence summarizing the overall flavor palette available.

SECTION 3 - RECIPE RECOMMENDATIONS

Repeat this block exactly 3 times:

RECIPE_START
Name: [Dish name]
Description: [One sentence describing taste and texture]
Cuisine alignment: [How this fits the selected cuisine]
Dietary compliance: [Confirm which dietary mode this satisfies]
Ingredients used: [List only ingredients visible in the image]
Cook time: [X minutes]
Difficulty: [Easy / Medium / Hard]
Cooking method: [Pan / Oven / No-cook / Air fryer / Microwave]
Steps:
1. [Step - maximum 2 sentences]
2. [Step - maximum 2 sentences]
3. [Step - maximum 2 sentences]
4. [Step - maximum 2 sentences]
5. [Step - maximum 2 sentences]
Healthiness score: [X/10] | [one-line justification]
Calories: [X] kcal
Protein: [X] grams
Carbohydrates: [X] grams
Fats: [X] grams
Chef tip: [One specific technique that elevates this dish]
RECIPE_END

SECTION 4 - RECIPE UNLOCK OPPORTUNITIES
List exactly 3 ingredients not visible in the fridge that would expand options.
Format: [ingredient] | [specific dish name aligned to cuisine preference]

SECTION 5 - SMART GROCERY RECOMMENDATIONS
List exactly 5 ingredients the user should purchase this week.
Format: [ingredient] | [existing ingredient it pairs with] | [dish idea]

SECTION 6 - FRIDGE ASSESSMENT SCORECARD
Variety: [X/10]
Nutrition: [X/10]
Meal Potential: [X/10]
Overall: [X/10]
Assessment: [One encouraging sentence with one specific improvement suggestion]

CONSTRAINTS
- Never hallucinate ingredients. Only use what is clearly visible in the image
- Never violate the dietary mode. This overrides all other rules
- Never repeat the same primary protein across all 3 recipes
- Every instruction must be specific with times and temperatures where relevant
- If the image is not food-related or too blurry output only:
  The uploaded image could not be analyzed. Please upload a well-lit clear photo of your refrigerator or ingredients.
- Always match cuisine preference strictly
- Maintain a professional warm and encouraging tone throughout`;

      // Clean the base64 string
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: {
          parts: [
            { text: 'Please analyze this photo according to your system instructions.' },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          ],
        },
        config: {
          systemInstruction,
        }
      });

      res.json({ result: response.text });
    } catch (error: any) {
      console.error('Error generating response:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze fridge' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
