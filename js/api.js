/**
 * API Service för TheMealDB - Rafeds Receptsamling
 * Hanterar alla API-interaktioner med TheMealDB för internationella recept
 */
class RecipeAPI {
    constructor() {
        this.baseURL = 'https://www.themealdb.com/api/json/v1/1/';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000;
        
        this.searchSynonyms = {
            'pasta': ['spaghetti', 'linguine', 'macaroni'],
            'chicken': ['poultry', 'fowl'],
            'beef': ['steak', 'meat'],
            'fish': ['salmon', 'tuna', 'cod'],
            'soup': ['broth', 'stew'],
            'cake': ['dessert', 'sweet']
        };

        this.ingredientTranslations = {
            'kyckling': 'chicken',
            'nötkött': 'beef',
            'fläsk': 'pork',
            'fisk': 'fish',
            'ris': 'rice',
            'pasta': 'pasta',
            'potatis': 'potato',
            'lök': 'onion',
            'vitlök': 'garlic',
            'tomat': 'tomato',
            'morot': 'carrot',
            'citron': 'lemon'
        };
    }

    /**
     * Hämtningsmetod med caching och felhantering
     */
    async fetchData(endpoint, useCache = true) {
        const cacheKey = endpoint;
        
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const response = await fetch(this.baseURL + endpoint);
            
            if (!response.ok) {
                throw new Error(`HTTP-fel! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (useCache) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
            
        } catch (error) {
            console.error('API-hämtningsfel:', error);
            throw new Error(`Misslyckades att hämta data: ${error.message}`);
        }
    }

    /**
     * Sökning efter namn med synonymstöd
     */
    async searchByName(name) {
        if (!name || name.trim().length < 2) {
            throw new Error('Sökterm måste vara minst 2 tecken lång');
        }

        const searchTerm = name.trim().toLowerCase();
        let searchResults = [];

        try {
            const data = await this.fetchData(`search.php?s=${encodeURIComponent(searchTerm)}`);
            if (data.meals) {
                searchResults = [...data.meals];
            }
        } catch (error) {
            console.error('Sökning misslyckades:', error);
        }

        if (searchResults.length < 3) {
            for (const [correct, synonyms] of Object.entries(this.searchSynonyms)) {
                if (synonyms.some(syn => syn.includes(searchTerm) || searchTerm.includes(syn))) {
                    try {
                        const synData = await this.fetchData(`search.php?s=${encodeURIComponent(correct)}`);
                        if (synData.meals) {
                            synData.meals.forEach(meal => {
                                if (!searchResults.some(existing => existing.idMeal === meal.idMeal)) {
                                    searchResults.push(meal);
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Synonymsökning för ${correct} misslyckades:`, error);
                    }
                }
            }
        }

        return searchResults;
    }

    /**
     * Ingredienssökning
     */
    async searchByIngredient(ingredient) {
        if (!ingredient || ingredient.trim().length < 2) {
            throw new Error('Ingrediens måste vara minst 2 tecken lång');
        }

        let searchTerm = ingredient.trim().toLowerCase();
        
        if (this.ingredientTranslations[searchTerm]) {
            searchTerm = this.ingredientTranslations[searchTerm];
        }

        const data = await this.fetchData(`filter.php?i=${encodeURIComponent(searchTerm)}`);
        return data.meals || [];
    }

    /**
     * Hämtar receptdetaljer efter ID med svenska beskrivningar
     */
    async getRecipeById(id) {
        if (!id) {
            throw new Error('Recept-ID krävs');
        }

        const data = await this.fetchData(`lookup.php?i=${id}`);
        const recipe = data.meals ? data.meals[0] : null;
        
        if (recipe) {
            recipe.swedishCategory = this.translateCategory(recipe.strCategory);
            recipe.swedishArea = this.translateArea(recipe.strArea);
        }
        
        return recipe;
    }

    /**
     * Översätter kategorier till svenska
     */
    translateCategory(category) {
        const translations = {
            'Beef': 'Nötkött',
            'Chicken': 'Kyckling',
            'Dessert': 'Dessert',
            'Lamb': 'Lamm',
            'Pasta': 'Pasta',
            'Pork': 'Fläsk',
            'Seafood': 'Skaldjur',
            'Side': 'Tillbehör',
            'Starter': 'Förrätt',
            'Vegan': 'Vegansk',
            'Vegetarian': 'Vegetarisk',
            'Breakfast': 'Frukost',
            'Goat': 'Get'
        };
        return translations[category] || category;
    }

    /**
     * Översätter områden till svenska
     */
    translateArea(area) {
        const translations = {
            'American': 'Amerikansk',
            'British': 'Brittisk',
            'Canadian': 'Kanadensisk',
            'Chinese': 'Kinesisk',
            'Croatian': 'Kroatisk',
            'Dutch': 'Holländsk',
            'Egyptian': 'Egyptisk',
            'French': 'Fransk',
            'Greek': 'Grekisk',
            'Indian': 'Indisk',
            'Irish': 'Irländsk',
            'Italian': 'Italiensk',
            'Jamaican': 'Jamaicansk',
            'Japanese': 'Japansk',
            'Kenyan': 'Kenyansk',
            'Malaysian': 'Malaysisk',
            'Mexican': 'Mexikansk',
            'Moroccan': 'Marockansk',
            'Polish': 'Polsk',
            'Portuguese': 'Portugisisk',
            'Russian': 'Rysk',
            'Spanish': 'Spansk',
            'Thai': 'Thailändsk',
            'Tunisian': 'Tunisisk',
            'Turkish': 'Turkisk',
            'Unknown': 'Okänd',
            'Vietnamese': 'Vietnamesisk',
            'Lebanese': 'Libanesisk'
        };
        return translations[area] || area;
    }

    /**
     * Hämtar slumpmässiga recept
     */
    async getRandomRecipes(count = 1) {
        const recipes = [];
        let attempts = 0;
        const maxAttempts = count * 3;
        
        while (recipes.length < count && attempts < maxAttempts) {
            try {
                const data = await this.fetchData('random.php', false);
                if (data.meals && data.meals[0]) {
                    const recipe = data.meals[0];
                    
                    recipe.swedishCategory = this.translateCategory(recipe.strCategory);
                    recipe.swedishArea = this.translateArea(recipe.strArea);
                    
                    if (!recipes.some(r => r.idMeal === recipe.idMeal)) {
                        recipes.push(recipe);
                    }
                }
            } catch (error) {
                console.error(`Misslyckades att hämta slumpmässigt recept ${attempts + 1}:`, error);
            }
            attempts++;
        }
        
        return recipes;
    }

    /**
     * Hämtar internationella recept
     */
    async getInternationalRecipes(limit = 100) {
        const allRecipes = [];
        
        for (const term of searchTerms) {
            try {
                const recipes = await this.searchByName(term);
                
                recipes.forEach(recipe => {
                    recipe.swedishCategory = this.translateCategory(recipe.strCategory);
                    recipe.swedishArea = this.translateArea(recipe.strArea);
                });
                
                allRecipes.push(...recipes);
                
                if (allRecipes.length >= limit) break;
            } catch (error) {
                console.error(`Misslyckades att söka efter ${term}:`, error);
            }
        }

        const uniqueRecipes = allRecipes.reduce((unique, recipe) => {
            if (!unique.some(r => r.idMeal === recipe.idMeal)) {
                unique.push(recipe);
            }
            return unique;
        }, []);

        return uniqueRecipes.slice(0, limit);
    }

    /**
     * Hämtar alla tillgängliga kategorier
     */
    async getCategories() {
        const data = await this.fetchData('categories.php');
        const categories = data.categories || [];
        
        return categories.map(cat => ({
            ...cat,
            swedishName: this.translateCategory(cat.strCategory)
        }));
    }

    /**
     * Filtrera recept efter kategori
     */
    async getRecipesByCategory(category) {
        if (!category) {
            throw new Error('Kategori krävs');
        }

        const data = await this.fetchData(`filter.php?c=${encodeURIComponent(category)}`);
        const recipes = data.meals || [];
        
        return recipes.map(recipe => ({
            ...recipe,
            swedishCategory: this.translateCategory(category),
            swedishArea: this.translateArea(recipe.strArea)
        }));
    }

    /**
     * Hämtar receptingredienser som en formaterad array
     */
    getFormattedIngredients(recipe) {
        if (!recipe) return [];

        const ingredients = [];
        
        for (let i = 1; i <= 20; i++) {
            const ingredient = recipe[`strIngredient${i}`];
            const measure = recipe[`strMeasure${i}`];
            
            if (ingredient && ingredient.trim()) {
                const theIngredient = ingredient.trim();
                ingredients.push({
                    name: ingredient.trim(),
                    finalName: theIngredient,
                    measure: measure ? measure.trim() : '',
                    full: measure && measure.trim() ? 
                          `${measure.trim()} ${theIngredient}` : 
                          theIngredient
                });
            }
        }
        
        return ingredients;
    }


    /**
     * Rensar cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Hämtar cache-statistik för felsökning
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            timestamps: Array.from(this.cache.values()).map(v => new Date(v.timestamp))
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecipeAPI;
}