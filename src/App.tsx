import React, { useCallback, useState } from 'react';
import { Upload, ChefHat, Info, Loader2, ImagePlus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

export default function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState('');
  const [dietaryMode, setDietaryMode] = useState('No restriction');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
         // Reset previous output
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  const analyzeFridge = async () => {
    if (!imagePreview) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze-fridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imagePreview,
          cuisine: cuisine.trim(),
          dietaryMode: dietaryMode,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze fridge');
      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
  };

  const parseResult = (text: string) => {
    const lines = text.split('\n');
    const ingredients: { name: string; conf: string }[] = [];
    let flavorProfile = '';
    const scorecard = { variety: '0', nutrition: '0', mealPot: '0', overall: '0', assessment: '' };
    const unlocks: { ingredient: string; dish: string }[] = [];
    const groceries: { item: string; pairs: string; dish: string }[] = [];

    // Parse Sections 1, 2, 4, 5, 6
    let currentSection = '';
    for (const line of lines) {
      if (line.includes('SECTION 1')) currentSection = '1';
      else if (line.includes('SECTION 2')) currentSection = '2';
      else if (line.includes('SECTION 3')) currentSection = '3';
      else if (line.includes('SECTION 4')) currentSection = '4';
      else if (line.includes('SECTION 5')) currentSection = '5';
      else if (line.includes('SECTION 6')) currentSection = '6';
      else {
        if (currentSection === '1' && line.includes('|')) {
          const parts = line.split('|').map((p) => p.trim());
          if (parts.length >= 2) ingredients.push({ name: parts[0].replace(/^-*\s*/, ''), conf: parts[1] });
        } else if (currentSection === '2' && line.trim() && !flavorProfile) {
          flavorProfile = line.trim();
        } else if (currentSection === '4' && line.includes('|')) {
          const parts = line.split('|').map((p) => p.trim());
          unlocks.push({ ingredient: parts[0].replace(/^-*\s*/, ''), dish: parts[1] || '' });
        } else if (currentSection === '5' && line.includes('|')) {
          const parts = line.split('|').map((p) => p.trim());
          groceries.push({ item: parts[0].replace(/^-*\s*/, ''), pairs: parts[1] || '', dish: parts[2] || '' });
        } else if (currentSection === '6') {
          if (line.includes('Variety:')) scorecard.variety = line.split(':')[1]?.split('/')[0]?.trim() || '0';
          if (line.includes('Nutrition:')) scorecard.nutrition = line.split(':')[1]?.split('/')[0]?.trim() || '0';
          if (line.includes('Meal Potential:')) scorecard.mealPot = line.split(':')[1]?.split('/')[0]?.trim() || '0';
          if (line.includes('Overall:')) scorecard.overall = line.split(':')[1]?.split('/')[0]?.trim() || '0';
          if (line.includes('Assessment:')) scorecard.assessment = line.replace('Assessment:', '').trim();
        }
      }
    }

    // Parse Recipes
    const recipes: any[] = [];
    const recipeBlocks = text.split('RECIPE_START');
    for (let i = 1; i < recipeBlocks.length; i++) {
        const block = recipeBlocks[i].split('RECIPE_END')[0].trim();
        const rLines = block.split('\n');
        const recipe: any = { steps: [] };
        let inSteps = false;
        
        for (const rl of rLines) {
            const line = rl.trim();
            if (line.startsWith('Name:')) recipe.name = line.replace('Name:', '').trim();
            else if (line.startsWith('Description:')) recipe.desc = line.replace('Description:', '').trim();
            else if (line.startsWith('Cook time:')) recipe.cookTime = line.replace('Cook time:', '').trim();
            else if (line.startsWith('Difficulty:')) recipe.difficulty = line.replace('Difficulty:', '').trim();
            else if (line.startsWith('Cooking method:')) recipe.method = line.replace('Cooking method:', '').trim();
            else if (line.startsWith('Dietary compliance:')) recipe.compliance = line.replace('Dietary compliance:', '').trim();
            else if (line.startsWith('Ingredients used:')) recipe.ingredientsUsed = line.replace('Ingredients used:', '').trim();
            else if (line.startsWith('Healthiness score:')) recipe.healthiness = line.replace('Healthiness score:', '').split('|')[0].trim().replace('/10', '').trim();
            else if (line.startsWith('Calories:')) recipe.calories = line.replace('Calories:', '').trim();
            else if (line.startsWith('Protein:')) recipe.protein = line.replace('Protein:', '').trim();
            else if (line.startsWith('Carbohydrates:')) recipe.carbs = line.replace('Carbohydrates:', '').trim();
            else if (line.startsWith('Fats:')) recipe.fats = line.replace('Fats:', '').trim();
            else if (line.startsWith('Chef tip:')) recipe.chefTip = line.replace('Chef tip:', '').trim();
            else if (line.startsWith('Steps:')) inSteps = true;
            else if (inSteps && line && /^\d+\./.test(line)) recipe.steps.push(line.replace(/^\d+\.\s*/, ''));
        }
        if (recipe.name) recipes.push(recipe);
    }

    return { ingredients, flavorProfile, scorecard, recipes, unlocks, groceries };
  };

  const parsedData = result ? parseResult(result) : null;

  return (
    <div className="min-h-screen bg-theme-bg text-theme-ink font-sans">
      {/* Header */}
      <header className="bg-theme-card border-b border-theme-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-theme-accent-light p-2 rounded-lg text-theme-accent">
              <ChefHat className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold font-serif text-theme-accent uppercase tracking-wide">
              FRIDGECHEF <span className="font-light">AI</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro */}
        <section className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Transform Your Fridge Into a Feast
          </h2>
          <p className="text-theme-ink/70 text-lg">
            Upload a photo of your ingredients, set your preferences, and let our Michelin-level AI construct your next perfect meal.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls & Upload (Left Side) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Upload Area */}
            <div className="bg-theme-card rounded-lg p-6 border border-theme-border flex flex-col overflow-hidden">
              <h3 className="text-sm font-serif font-bold text-theme-ink bg-[#FAF9F7] border-b border-theme-border px-6 py-3 -mx-6 -mt-6 mb-6">
                1. Snap Your Ingredients
              </h3>
              {!imagePreview ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-theme-accent bg-theme-accent-light' : 'border-theme-border hover:border-theme-accent/50 hover:bg-[#FAF9F7]'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-theme-accent/60 mb-4" />
                  <p className="text-sm text-theme-ink font-medium mb-1">
                    {isDragActive ? 'Drop your photo here' : 'Drag & drop a photo, or click to select'}
                  </p>
                  <p className="text-xs text-theme-ink/60">Supports JPG, PNG, WEBP</p>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden group border border-theme-border">
                  <img src={imagePreview} alt="Fridge contents" className="w-full h-48 object-cover transform transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                      className="bg-theme-card text-theme-ink px-4 py-2 rounded font-medium shadow hover:bg-theme-border/20 transition-colors"
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className="bg-theme-card rounded-lg p-6 border border-theme-border space-y-5 flex flex-col overflow-hidden">
              <h3 className="text-sm font-serif font-bold text-theme-ink bg-[#FAF9F7] border-b border-theme-border px-6 py-3 -mx-6 -mt-6 mb-2">
                2. Set Preferences
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuisine Preference (Optional)
                </label>
                <input
                  type="text"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  placeholder="e.g. Italian, Thai, Mexican..."
                  className="w-full px-4 py-2.5 rounded border border-theme-border focus:ring-1 focus:ring-theme-accent focus:border-theme-accent transition-shadow outline-none bg-white text-theme-ink"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dietary Mode
                </label>
                <select
                  value={dietaryMode}
                  onChange={(e) => setDietaryMode(e.target.value)}
                  className="w-full px-4 py-2.5 rounded border border-theme-border focus:ring-1 focus:ring-theme-accent focus:border-theme-accent transition-shadow outline-none bg-white text-theme-ink appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236B7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                >
                  <option value="No restriction">No restriction</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Halal">Halal</option>
                  <option value="Eggetarian">Eggetarian</option>
                  <option value="Gluten-Free">Gluten-Free</option>
                </select>
              </div>

              <button
                onClick={analyzeFridge}
                disabled={!imagePreview || loading}
                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded shadow-sm text-base font-medium text-white bg-theme-accent hover:bg-theme-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Analyzing Fridge...
                  </>
                ) : (
                  <>
                    <ChefHat className="-ml-1 mr-2 h-5 w-5" />
                    Generate Meal Plan
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results (Right Side) */}
          <div className="lg:col-span-7">
            <div className="bg-theme-card rounded-lg border border-theme-border h-full min-h-[500px] flex flex-col overflow-hidden shadow-sm">
              
              {/* Empty State */}
              {!result && !loading && !error && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-theme-ink/60 relative">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#1A1A1A_70%,transparent_100%)] opacity-[0.03] -z-10"></div>
                  <ImagePlus className="w-16 h-16 text-theme-border mb-4" />
                  <p className="text-lg max-w-sm">Upload a photo and generate to see your custom meal plan here.</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="p-6 m-6 bg-red-50 text-red-700 rounded border border-red-200 flex items-start space-x-3">
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Analysis Failed</h4>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-pulse">
                  <div className="relative mb-6">
                     <div className="absolute inset-0 rounded-full blur-xl bg-theme-accent/20 translate-y-2 scale-110"></div>
                     <ChefHat className="h-16 w-16 text-theme-accent relative z-10 animate-bounce" />
                  </div>
                  <h3 className="text-xl font-semibold text-theme-ink font-serif mb-2">Chef is inspecting your ingredients</h3>
                  <p className="text-theme-ink/60">Cross-referencing recipes, evaluating flavor combinations, and checking dietary rules...</p>
                </div>
              )}

			  {/* Result State */}
			  {parsedData && !loading && (
				<div className="flex-1 overflow-y-auto w-full p-6 space-y-8">
				  {/* Ingredients */}
				  {parsedData.ingredients.length > 0 && (
					<div>
					  <h3 className="text-sm font-serif font-bold text-theme-ink mb-3 uppercase tracking-wide border-b border-theme-border pb-2">
						Ingredients Detected
					  </h3>
					  <div className="flex flex-wrap gap-2">
						{parsedData.ingredients.map((ing, idx) => (
						  <span key={idx} className="inline-flex items-center px-3 py-1 rounded bg-theme-bg border border-theme-border text-xs font-medium text-theme-ink">
							{ing.conf === 'High' ? '🟢' : ing.conf === 'Medium' ? '🟡' : '⚪'} <span className="ml-1.5">{ing.name}</span>
						  </span>
						))}
					  </div>
					</div>
				  )}

				  {/* Flavor Profile */}
				  {parsedData.flavorProfile && (
					<div className="bg-theme-accent-light border-l-4 border-theme-accent py-3 px-4 rounded-r font-serif italic text-sm text-theme-ink border-y border-r">
					  🌿 {parsedData.flavorProfile}
					</div>
				  )}

				  {/* Scorecard */}
				  {parsedData.scorecard.overall !== '0' && (
					<div>
					  <div className="grid grid-cols-4 gap-3">
					    <div className="bg-theme-bg rounded-lg p-3 text-center border border-theme-border">
					      <div className="text-2xl font-bold text-theme-ink">{parsedData.scorecard.variety}<span className="text-base font-normal">/10</span></div>
					      <div className="text-[10px] uppercase tracking-wide text-theme-ink/60 mt-0.5">Variety</div>
					    </div>
					    <div className="bg-theme-bg rounded-lg p-3 text-center border border-theme-border">
					      <div className="text-2xl font-bold text-theme-ink">{parsedData.scorecard.nutrition}<span className="text-base font-normal">/10</span></div>
					      <div className="text-[10px] uppercase tracking-wide text-theme-ink/60 mt-0.5">Nutrition</div>
					    </div>
					    <div className="bg-theme-bg rounded-lg p-3 text-center border border-theme-border">
					      <div className="text-2xl font-bold text-theme-ink">{parsedData.scorecard.mealPot}<span className="text-base font-normal">/10</span></div>
					      <div className="text-[10px] uppercase tracking-wide text-theme-ink/60 mt-0.5">Potential</div>
					    </div>
					    <div className="bg-theme-accent-light rounded-lg p-3 text-center border border-theme-accent/30">
					      <div className="text-2xl font-bold text-theme-accent">{parsedData.scorecard.overall}<span className="text-base font-normal">/10</span></div>
					      <div className="text-[10px] uppercase tracking-wide text-theme-accent/80 mt-0.5">Overall</div>
					    </div>
					  </div>
					  {parsedData.scorecard.assessment && (
						<p className="text-xs text-theme-ink/70 mt-3 text-center">{parsedData.scorecard.assessment}</p>
					  )}
					</div>
				  )}

				  {/* Recipes */}
				  {parsedData.recipes.length > 0 && (
					<div>
					  <h3 className="text-sm font-serif font-bold text-theme-ink mb-4 uppercase tracking-wide border-b border-theme-border pb-2">
						Your Personalized Recipes
					  </h3>
					  <div className="space-y-4">
					    {parsedData.recipes.map((recipe, idx) => (
						  <details key={idx} className="group bg-white border border-theme-border rounded-lg overflow-hidden [&_summary::-webkit-details-marker]:hidden" open={idx === 0}>
							<summary className="cursor-pointer p-4 select-none bg-[#FAF9F7] flex items-center justify-between hover:bg-theme-bg transition-colors">
							  <div className="flex-1">
								<h4 className="text-lg font-serif font-bold text-theme-accent">{idx + 1}. {recipe.name}</h4>
								<p className="text-sm text-theme-ink/70 mt-0.5 italic">{recipe.desc}</p>
							  </div>
							  <div className="bg-theme-accent-light text-theme-accent px-3 py-1 rounded text-sm font-bold border border-theme-accent/20">
								{recipe.healthiness}<span className="text-xs font-normal">/10</span>
							  </div>
							</summary>
							<div className="p-5 border-t border-theme-border">
							  <div className="text-xs text-theme-ink/70 mb-4 pb-4 border-b border-theme-border space-y-1.5">
								<div><strong>Dietary:</strong> {recipe.compliance}</div>
								<div><strong>Ingredients used:</strong> {recipe.ingredientsUsed}</div>
								<div className="flex space-x-4 mt-2 pt-2">
								  <span><strong>Time:</strong> {recipe.cookTime}</span>
								  <span><strong>Diff:</strong> {recipe.difficulty}</span>
								  <span><strong>Method:</strong> {recipe.method}</span>
								</div>
							  </div>
							  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
								  <h5 className="font-bold text-sm mb-2">Instructions</h5>
								  <ul className="text-sm space-y-2">
									{recipe.steps.map((step: string, sIdx: number) => (
									  <li key={sIdx} className="flex"><span className="text-theme-accent mr-2 font-bold select-none">•</span> <span>{step}</span></li>
									))}
								  </ul>
								</div>
								<div>
								  <h5 className="font-bold text-sm mb-2">Nutrition per serving</h5>
								  <div className="grid grid-cols-2 gap-2">
									<div className="bg-theme-bg p-2 rounded border border-theme-border text-center">
									  <div className="font-bold text-theme-ink">{recipe.calories}</div>
									  <div className="text-[10px] text-theme-ink/60 uppercase">Kcal</div>
									</div>
									<div className="bg-theme-bg p-2 rounded border border-theme-border text-center">
									  <div className="font-bold text-theme-ink">{recipe.protein}</div>
									  <div className="text-[10px] text-theme-ink/60 uppercase">Protein</div>
									</div>
									<div className="bg-theme-bg p-2 rounded border border-theme-border text-center">
									  <div className="font-bold text-theme-ink">{recipe.carbs}</div>
									  <div className="text-[10px] text-theme-ink/60 uppercase">Carbs</div>
									</div>
									<div className="bg-theme-bg p-2 rounded border border-theme-border text-center">
									  <div className="font-bold text-theme-ink">{recipe.fats}</div>
									  <div className="text-[10px] text-theme-ink/60 uppercase">Fats</div>
									</div>
								  </div>
								  {recipe.chefTip && (
									<div className="mt-4 bg-[#FFF9E6] border border-[#FFEBB3] p-3 rounded text-xs text-[#92400e]">
									  <strong>Chef Tip:</strong> {recipe.chefTip}
									</div>
								  )}
								</div>
							  </div>
							</div>
						  </details>
					    ))}
					  </div>
					</div>
				  )}

				  {/* Unlocks and Groceries */}
				  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{parsedData.unlocks.length > 0 && (
					  <div>
					    <h3 className="text-sm font-serif font-bold text-theme-ink mb-3 uppercase tracking-wide border-b border-theme-border pb-2">
						  Unlock More Recipes
					    </h3>
					    <div className="space-y-2">
						  {parsedData.unlocks.map((u, i) => (
						    <div key={i} className="text-sm bg-theme-bg border border-theme-border p-2.5 rounded flex items-start gap-2">
							  <div className="w-1.5 h-1.5 rounded-full bg-theme-accent mt-1.5 flex-shrink-0"></div>
							  <div>
							    <strong className="text-theme-ink">{u.ingredient}</strong>
							    <span className="text-theme-ink/60"> — unlocks {u.dish}</span>
							  </div>
						    </div>
						  ))}
					    </div>
					  </div>
					)}

					{parsedData.groceries.length > 0 && (
					  <div>
					    <h3 className="text-sm font-serif font-bold text-theme-ink mb-3 uppercase tracking-wide border-b border-theme-border pb-2">
						  Smart Grocery List
					    </h3>
					    <div className="space-y-2">
						  {parsedData.groceries.map((g, i) => (
						    <div key={i} className="text-sm bg-theme-bg border border-theme-border p-2.5 rounded flex items-start gap-2">
							  <div className="text-[10px] mt-0.5">🛒</div>
							  <div>
							    <strong className="text-theme-ink block">{g.item}</strong>
							    <span className="text-theme-ink/60 text-xs">Pairs with {g.pairs} — {g.dish}</span>
							  </div>
						    </div>
						  ))}
					    </div>
					  </div>
					)}
				  </div>
				</div>
			  )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
