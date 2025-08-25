/**
 * Huvudapplikationskontroller - Rafeds Receptsamling
 * Hanterar DOM-manipulation, användarinteraktioner och recept-widget-funktionalitet
 */
class RafedRecepieApp {
    constructor() {
        this.api = new RecipeAPI();
        this.currentPage = this.getCurrentPage();
        this.isLoading = false;
        this.searchHistory = [];
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialiserar applikationen
     */
    async init() {
        try {
            this.setupNavigation();
            this.setupEventListeners();
            await this.initializePage();
            this.setupRecipeWidget();
            //console.log('App initialiserad');
        } catch (error) {
            console.error('Misslyckades att initialisera app:', error);
            this.showError('Det gick inte att ladda applikationen. Försök ladda om sidan.');
        }
    }

    /**
     * Hämtar nuvarande sida från URL
     */
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('search.html')) return 'search';
        if (path.includes('categories.html')) return 'categories';
        if (path.includes('randoms.html')) return 'random';
        if (path.includes('about.html')) return 'about';
        return 'home';
    }

    /**
     * Konfigurerar mobilnavigation
     */
    setupNavigation() {
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const navMenu = document.querySelector('.nav-menu');

        if (mobileToggle && navMenu) {
            mobileToggle.addEventListener('click', () => {
                const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
                
                mobileToggle.setAttribute('aria-expanded', !isExpanded);
                navMenu.classList.toggle('active');
                
                const lines = mobileToggle.querySelectorAll('.hamburger-line');
                lines.forEach((line, index) => {
                    if (navMenu.classList.contains('active')) {
                        if (index === 0) line.style.transform = 'rotate(45deg) translate(5px, 5px)';
                        if (index === 1) line.style.opacity = '0';
                        if (index === 2) line.style.transform = 'rotate(-45deg) translate(7px, -6px)';
                    } else {
                        line.style.transform = '';
                        line.style.opacity = '';
                    }
                });
            });

            document.addEventListener('click', (e) => {
                if (!mobileToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    mobileToggle.setAttribute('aria-expanded', 'false');
                    navMenu.classList.remove('active');
                    
                    const lines = mobileToggle.querySelectorAll('.hamburger-line');
                    lines.forEach(line => {
                        line.style.transform = '';
                        line.style.opacity = '';
                    });
                }
            });
        }
    }

    /**
     * Konfigurerar allmänna händelselyssnare
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-search-btn')) {
                const searchTerm = e.target.dataset.search;
                if (searchTerm) {
                    this.performQuickSearch(searchTerm);
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('recipe-btn')) {
                const searchTerm = e.target.dataset.search;
                if (searchTerm) {
                    this.showRecipeDetails(searchTerm);
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                const category = e.target.dataset.category;
                if (category) {
                    this.showCategoryRecipes(category);
                }
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.classList.contains('search-form')) {
                e.preventDefault();
                this.handleSearchSubmit(e.target);
            }
        });
    }

    /**
     * Initialiserar sidspecifikt innehåll
     */
    async initializePage() {
        switch (this.currentPage) {
            case 'home':
                await this.initHomePage();
                break;
            case 'search':
                this.initSearchPage();
                break;
            case 'random':
                await this.initRandomPage();
                break;
        }
    }

    /**
     * Initialiserar startsida
     */
    async initHomePage() {
        try {
            await this.loadDailyRecipes();
        } catch (error) {
            console.error('Misslyckades att ladda startsidans innehåll:', error);
        }
    }

    /**
     * Laddar dagens recept för startsida
     */
    async loadDailyRecipes() {
        const container = document.getElementById('daily-recipes');
        if (!container) return;

        this.showLoading(container);

        try {
            const recipes = await this.api.getRandomRecipes(6);
            
            if (recipes.length > 0) {
                container.innerHTML = '';
                recipes.forEach(recipe => {
                    const recipeCard = this.createRecipeCard(recipe);
                    container.appendChild(recipeCard);
                });
            } else {
                container.innerHTML = this.createEmptyState('Inga recept hittades just nu. Prova att söka efter specifika rätter.');
            }
        } catch (error) {
            console.error('Misslyckades att ladda dagens recept:', error);
            container.innerHTML = this.createErrorState('Det gick inte att ladda recepten. Försök igen senare.');
        }
    }

    /**
     * Initialiserar söksida
     */
    initSearchPage() {
        this.setupSearchTabs();
        this.setupSearchForm();
        
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            const nameInput = document.getElementById('recipe-name');
            if (nameInput) {
                nameInput.value = query;
                this.performSearch({ name: query }, 'name');
            }
        }
    }

    /**
     * Konfigurerar sökflikarnas funktionalitet
     */
    setupSearchTabs() {
        const tabs = document.querySelectorAll('.tab-button');
        const panels = document.querySelectorAll('.search-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                panels.forEach(p => {
                    p.classList.remove('active');
                    p.hidden = true;
                });

                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                
                const targetPanel = document.getElementById(tab.getAttribute('aria-controls'));
                if (targetPanel) {
                    targetPanel.classList.add('active');
                    targetPanel.hidden = false;
                }
            });
        });
    }

    /**
     * Konfigurerar sökformulär
     */
    setupSearchForm() {
        const form = document.querySelector('.search-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSearchSubmit(form);
        });
    }

    /**
     * Hanterar sökformulärinskickning
     */
    async handleSearchSubmit(form) {
        const formData = new FormData(form);
        const activePanel = form.querySelector('.search-panel.active');
        
        if (!activePanel) return;

        const filters = {
            name: formData.get('recipe-name')?.trim() || '',
            ingredient: formData.get('ingredient-name') || ''
        };

        const searchType = activePanel.id === 'name-search' ? 'name' : 'ingredient';
        
        await this.performSearch(filters, searchType);
    }

    /**
     * Utför sökning och visar resultat
     */
    async performSearch(filters, searchType) {
        const resultsContainer = document.getElementById('search-results');
        const resultsHeading = document.getElementById('results-heading');
        
        if (!resultsContainer) return;

        this.showLoading(resultsContainer);
        
        if (resultsHeading) {
            resultsHeading.hidden = false;
            resultsHeading.textContent = 'Sökresultat';
        }

        try {
            let recipes = [];

            if (searchType === 'name' && filters.name) {
                recipes = await this.api.searchByName(filters.name);
                this.addToSearchHistory(filters.name);
            } else if (searchType === 'ingredient' && filters.ingredient) {
                recipes = await this.api.searchByIngredient(filters.ingredient);
                this.addToSearchHistory(filters.ingredient);
            }

            this.displaySearchResults(recipes, resultsContainer);
            
        } catch (error) {
            console.error('Sökning misslyckades:', error);
            resultsContainer.innerHTML = this.createErrorState('Sökningen misslyckades. Försök igen.');
        }
    }

    /**
     * Utför snabbsökning från knappar
     */
    async performQuickSearch(searchTerm) {
        if (this.currentPage !== 'search') {
            const url = `search.html?q=${encodeURIComponent(searchTerm)}`;
            window.location.href = url;
            return;
        }

        const nameInput = document.getElementById('recipe-name');
        if (nameInput) {
            nameInput.value = searchTerm;
            
            const nameTab = document.getElementById('name-tab');
            const namePanel = document.getElementById('name-search');
            
            if (nameTab && namePanel) {
                document.querySelectorAll('.tab-button').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.search-panel').forEach(p => {
                    p.classList.remove('active');
                    p.hidden = true;
                });
                
                nameTab.classList.add('active');
                nameTab.setAttribute('aria-selected', 'true');
                namePanel.classList.add('active');
                namePanel.hidden = false;
            }
        }

        await this.performSearch({ name: searchTerm }, 'name');
    }

    /**
     * Visar sökresultat
     */
    displaySearchResults(recipes, container) {
        if (!recipes || recipes.length === 0) {
            container.innerHTML = this.createEmptyState('Inga recept hittades. Prova ett annat sökord eller kontrollera stavningen.');
            return;
        }

        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'recipe-grid';

        recipes.forEach(recipe => {
            const recipeCard = this.createRecipeCard(recipe);
            grid.appendChild(recipeCard);
        });

        container.appendChild(grid);
    }

    /**
     * Skapar ett receptkort-element
     */
    createRecipeCard(recipe) {
        const card = document.createElement('article');
        card.className = 'recipe-card';
        card.setAttribute('role', 'article');

        const img = document.createElement('img');
        img.src = recipe.strMealThumb || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop';
        img.alt = `Bild av ${recipe.strMeal}`;
        img.className = 'recipe-image';
        img.loading = 'lazy';
        
        img.onerror = function() {
            this.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop';
            this.alt = 'Standardbild för recept';
        };

        const content = document.createElement('div');
        content.className = 'recipe-content';

        const title = document.createElement('h3');
        title.className = 'recipe-title';
        title.textContent = recipe.strMeal;

        const description = document.createElement('p');
        description.className = 'recipe-description';
        
        const area = recipe.swedishArea || recipe.strArea || 'Internationell';
        const category = recipe.swedishCategory || recipe.strCategory || 'Huvudrätt';
        description.textContent = `${area} kök - ${category}`;

        const meta = document.createElement('div');
        meta.className = 'recipe-meta';
        meta.innerHTML = `
            <span>🍽️ ${category}</span>
            <span>🌍 ${area}</span>
        `;

        const button = document.createElement('button');
        button.className = 'recipe-btn';
        button.textContent = 'Visa recept';
        button.dataset.search = recipe.strMeal;
        button.setAttribute('aria-label', `Visa recept för ${recipe.strMeal}`);

        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(meta);
        content.appendChild(button);

        card.appendChild(img);
        card.appendChild(content);

        return card;
    }

    /**
     * Visar receptdetaljer i modal
     */
    async showRecipeDetails(recipeName) {
        try {
            const recipes = await this.api.searchByName(recipeName);
            if (recipes.length > 0) {
                const recipe = recipes[0];
                const details = await this.api.getRecipeById(recipe.idMeal);
                
                if (details) {
                    this.displayRecipeModal(details);
                } else {
                    this.showError('Kunde inte ladda receptdetaljer.');
                }
            } else {
                this.showError('Receptet hittades inte.');
            }
        } catch (error) {
            console.error('Misslyckades att visa receptdetaljer:', error);
            this.showError('Det gick inte att ladda receptet.');
        }
    }

    /**
     * Modal för recept
     */
    displayRecipeModal(recipe) {
        const ingredients = this.api.getFormattedIngredients(recipe);
        
        const instructions = recipe.strInstructions ? 
            recipe.strInstructions.split(/\r?\n/).filter(step => step.trim().length > 0) : 
            ['Instruktioner ej tillgängliga.'];

        const modal = document.createElement('div');
        modal.className = 'recipe-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 1000;
            display: flex; align-items: flex-start; justify-content: center;
            padding: 1rem; overflow-y: auto;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; border-radius: 12px; padding: 2rem;
            max-width: 700px; width: 100%; margin: 2rem auto;
            position: relative; max-height: calc(100vh - 4rem);
            overflow-y: auto;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            position: sticky; top: 0; right: 0; float: right;
            background: #2D004F; color: white; border: none; 
            border-radius: 50%; width: 35px; height: 35px; 
            cursor: pointer; font-size: 20px; font-weight: bold;
            z-index: 1001; margin-bottom: 1rem;
        `;
        closeBtn.setAttribute('aria-label', 'Stäng receptfönster');

        content.innerHTML = `
            <h2 style="color: #5D2E0A; margin-bottom: 1rem; margin-top: 0;">${recipe.strMeal}</h2>
            <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" 
                 style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 1.5rem;"
                 onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=300&fit=crop';">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div>
                    <h3 style="color: #5D2E0A; margin-bottom: 1rem;">Ingredienser:</h3>
                    <ul style="line-height: 1.8; padding-left: 1rem;">
                        ${ingredients.map(ing => `<li>${ing.full}</li>`).join('')}
                    </ul>
                </div>
                
                <div>
                    <h3 style="color: #5D2E0A; margin-bottom: 1rem;">Information:</h3>
                    <p><strong>Kategori:</strong> ${recipe.swedishCategory || recipe.strCategory}</p>
                    <p><strong>Ursprung:</strong> ${recipe.swedishArea || recipe.strArea}</p>
                    ${recipe.strTags ? `<p><strong>Tags:</strong> ${recipe.strTags}</p>` : ''}
                    ${recipe.strYoutube ? `<p><a href="${recipe.strYoutube}" target="_blank" style="color: #5D2E0A;">🎥 Se video på YouTube</a></p>` : ''}
                </div>
            </div>
            
            <h3 style="color: #5D2E0A; margin-bottom: 1rem;">Instruktioner:</h3>
            <div style="line-height: 1.8;">
                ${instructions.map((step, index) => 
                    `<p style="margin-bottom: 1rem;"><strong>Steg ${index + 1}:</strong> ${step}</p>`
                ).join('')}
            </div>
        `;

        content.insertBefore(closeBtn, content.firstChild);

        const closeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
            document.body.style.overflow = '';
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        document.addEventListener('keydown', escapeHandler);

        document.body.style.overflow = 'hidden';

        modal.appendChild(content);
        document.body.appendChild(modal);

        closeBtn.focus();
    }

    /**
     * Visar kategorirecept
     */
    async showCategoryRecipes(category) {
        const container = document.getElementById('category-recipes');
        const resultsHeading = document.getElementById('results-heading');
        
        if (!container) return;
        
        if (resultsHeading) {
            resultsHeading.hidden = false;
            resultsHeading.textContent = `Recept i kategorin: ${category}`;
        }
        
        this.showLoading(container);
        
        try {
            const recipes = await this.api.getRecipesByCategory(category);
            
            if (recipes.length > 0) {
                container.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'recipe-grid';
                grid.style.marginTop = '2rem';
                
                recipes.forEach(recipe => {
                    const recipeCard = this.createRecipeCard(recipe);
                    grid.appendChild(recipeCard);
                });
                
                container.appendChild(grid);
                
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
            } else {
                container.innerHTML = this.createEmptyState('Inga recept hittades i denna kategori.');
            }
        } catch (error) {
            console.error('Misslyckades att ladda kategorirecept:', error);
            container.innerHTML = this.createErrorState('Det gick inte att ladda recepten för denna kategori.');
        }
    }

    /**
     * Initialiserar slumpade maträtter-sidan
     */
    async initRandomPage() {
        await this.loadRandomRecipes();
        this.setupRandomRefreshButton();
    }

    /**
     * Laddar 12 slumpmässiga recept
     */
    async loadRandomRecipes() {
        const container = document.getElementById('random-favorites-grid');
        if (!container) return;
        
        this.showRandomLoading(container);
        
        try {
            const recipes = await this.api.getRandomRecipes(12);
            
            if (recipes.length > 0) {
                container.innerHTML = '';
                container.className = 'recipe-results-grid';
                
                recipes.forEach(recipe => {
                    const recipeCard = this.createRecipeCard(recipe);
                    container.appendChild(recipeCard);
                });
            } else {
                container.innerHTML = this.createRandomEmptyState('Kunde inte ladda slumpmässiga recept. Försök igen.');
            }
        } catch (error) {
            console.error('Misslyckades att ladda slumpmässiga recept:', error);
            container.innerHTML = this.createRandomErrorState('Det gick inte att ladda recepten. Försök igen.');
        }
    }

    /**
     * Konfigurerar refresh-knappen för slumpade recept
     */
    setupRandomRefreshButton() {
        const refreshBtn = document.getElementById('refresh-random');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '🎲 Laddar nya recept...';
                
                await this.loadRandomRecipes();
                
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🎲 Ladda nya slumpade recept';
            });
        }
    }

    /**
     * Konfigurerar Recept Widget
     */
    setupRecipeWidget() {
        const widgetContainer = document.getElementById('recipe-widget');
        if (!widgetContainer) return;

        widgetContainer.innerHTML = '';
        const widget = new RecipeWidget(widgetContainer, this.api);
        widget.init();
    }

    showLoading(container) {
        container.innerHTML = '<div class="loading-message" aria-live="polite"><p>Laddar recept...</p></div>';
    }

    showRandomLoading(container) {
        container.innerHTML = '<div class="loading-message" aria-live="polite"><p>Laddar slumpmässiga recept...</p></div>';
    }

    createEmptyState(message) {
        return `<div class="no-search-message"><p>${message}</p></div>`;
    }

    createErrorState(message) {
        return `<div class="error-message" style="text-align: center; color: #d32f2f; padding: 2rem;"><p>${message}</p></div>`;
    }

    createRandomEmptyState(message) {
        return `<div class="no-recipes-message"><p>${message}</p></div>`;
    }

    createRandomErrorState(message) {
        return `<div class="error-message" style="text-align: center; color: #d32f2f; padding: 2rem; grid-column: 1 / -1;"><p>${message}</p></div>`;
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #d32f2f;
            color: white; padding: 1rem; border-radius: 8px; z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }

    showSuccess(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #2e7d32;
            color: white; padding: 1rem; border-radius: 8px; z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 5000);
    }

    addToSearchHistory(term) {
        if (!this.searchHistory.includes(term)) {
            this.searchHistory.unshift(term);
            this.searchHistory = this.searchHistory.slice(0, 10);
        }
    }
}

/**
 * Recept Widget Klass
 */
class RecipeWidget {
    constructor(container, api) {
        this.container = container;
        this.api = api;
        this.currentRecipes = [];
        this.searchTerm = '';
    }

    async init() {
        this.createWidgetStructure();
        this.setupEventListeners();
        await this.loadInitialRecipes();
    }

    createWidgetStructure() {
        this.container.innerHTML = `
            <div class="widget-search">
                <input type="text" 
                       class="widget-search-input" 
                       placeholder="Sök recept eller ingrediens (på engelska)..."
                       aria-label="Sök recept">
                <button class="widget-search-btn" aria-label="Sök">🔍</button>
            </div>
            <div class="widget-results" aria-live="polite">
                <div class="widget-loading">Laddar recept...</div>
            </div>
        `;

        if (!document.querySelector('#widget-styles')) {
            const style = document.createElement('style');
            style.id = 'widget-styles';
            style.textContent = `
                .widget-header { text-align: center; margin-bottom: 1.5rem; }
                .widget-header h3 { color: var(--primary-color); margin-bottom: 0.5rem; font-size: 1.5rem; }
                .widget-header p { color: var(--text-color); opacity: 0.8; }
                .widget-search { 
                    display: flex; gap: 0.5rem; margin-bottom: 1rem; 
                    background: white; padding: 0.75rem; border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 2px solid var(--border-color);
                }
                .widget-search-input { 
                    flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); 
                    border-radius: 8px; outline: none; font-size: 1rem;
                }
                .widget-search-input:focus { border-color: var(--secondary-color); box-shadow: 0 0 0 3px rgba(218, 165, 32, 0.1); }
                .widget-search-btn { 
                    padding: 0.75rem 1rem; background: var(--secondary-color);
                    border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
                    font-size: 1.1rem;
                }
                .widget-search-btn:hover { background: var(--primary-color); transform: translateY(-1px); }
            
                .widget-results { min-height: 300px; }
                .widget-recipe-grid { 
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .widget-recipe-card { 
                    background: white; border-radius: 12px; overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.3s ease;
                    border: 2px solid var(--border-color);
                }
                .widget-recipe-card:hover { 
                    transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                    border-color: var(--secondary-color);
                }
                .widget-recipe-img { width: 100%; height: 160px; object-fit: cover; }
                .widget-recipe-content { padding: 1.25rem; }
                .widget-recipe-title { 
                    font-size: 1.1rem; font-weight: 700; color: var(--primary-color);
                    margin-bottom: 0.75rem; line-height: 1.3;
                }
                .widget-recipe-meta { 
                    font-size: 0.9rem; color: var(--text-color);
                    opacity: 0.8; margin-bottom: 1rem;
                }
                .widget-recipe-btn { 
                    width: 100%; padding: 0.75rem; background: var(--secondary-color);
                    border: none; border-radius: 8px; cursor: pointer;
                    font-weight: 600; transition: all 0.2s ease; font-size: 1rem;
                }
                .widget-recipe-btn:hover { 
                    background: var(--primary-color); color: white; transform: translateY(-1px);
                }
                .widget-loading, .widget-empty { 
                    text-align: center; padding: 3rem 1rem; color: var(--primary-color);
                    font-size: 1.1rem;
                }
                .widget-error { 
                    text-align: center; padding: 3rem 1rem; color: #d32f2f;
                    font-size: 1.1rem;
                }
                @media (max-width: 768px) {
                    .widget-recipe-grid { grid-template-columns: 1fr; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupEventListeners() {
        const searchInput = this.container.querySelector('.widget-search-input');
        const searchBtn = this.container.querySelector('.widget-search-btn');

        const performSearch = () => {
            this.searchTerm = searchInput.value.trim();
            this.searchRecipes();
        };

        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (searchInput.value.trim().length > 2) {
                    performSearch();
                }
            }, 500);
        });
    }

    async loadInitialRecipes() {
        try {
            const recipes = await this.api.getRandomRecipes(6);
            this.currentRecipes = recipes;
            this.displayRecipes(recipes);
        } catch (error) {
            console.error('Widget: Misslyckades att ladda initiala recept:', error);
            this.showError('Kunde inte ladda recept');
        }
    }

    async searchRecipes() {
        if (!this.searchTerm) {
            await this.loadInitialRecipes();
            return;
        }

        const resultsContainer = this.container.querySelector('.widget-results');
        resultsContainer.innerHTML = '<div class="widget-loading">🔍 Söker recept...</div>';

        try {
            let recipes = [];
            
            try {
                recipes = await this.api.searchByName(this.searchTerm);
            } catch {
                recipes = await this.api.searchByIngredient(this.searchTerm);
            }

            this.currentRecipes = recipes;
            this.displayRecipes(recipes);

        } catch (error) {
            console.error('Widget sökfel:', error);
            this.showError('Sökningen misslyckades');
        }
    }

    displayRecipes(recipes) {
        const resultsContainer = this.container.querySelector('.widget-results');

        if (!recipes || recipes.length === 0) {
            resultsContainer.innerHTML = '<div class="widget-empty">🍽️ Inga recept hittades<br><small>Prova ett annat sökord</small></div>';
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'widget-recipe-grid';

        recipes.slice(0, 6).forEach(recipe => {
            const card = this.createWidgetRecipeCard(recipe);
            grid.appendChild(card);
        });

        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(grid);
    }

    createWidgetRecipeCard(recipe) {
        const card = document.createElement('div');
        card.className = 'widget-recipe-card';

        const imgSrc = recipe.strMealThumb || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=160&fit=crop';
        const area = recipe.swedishArea || recipe.strArea || 'Internationell';
        const category = recipe.swedishCategory || recipe.strCategory || 'Huvudrätt';

        card.innerHTML = `
            <img src="${imgSrc}" 
                 alt="${recipe.strMeal}" 
                 class="widget-recipe-img"
                 onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=160&fit=crop'">
            <div class="widget-recipe-content">
                <h4 class="widget-recipe-title">${recipe.strMeal}</h4>
                <div class="widget-recipe-meta">${area} • ${category}</div>
                <button class="widget-recipe-btn" data-recipe-id="${recipe.idMeal}">
                    Visa recept
                </button>
            </div>
        `;

        const btn = card.querySelector('.widget-recipe-btn');
        btn.addEventListener('click', () => {
            window.app.showRecipeDetails(recipe.strMeal);
        });

        return card;
    }

    showError(message) {
        const resultsContainer = this.container.querySelector('.widget-results');
        resultsContainer.innerHTML = `<div class="widget-error">⚠️ ${message}</div>`;
    }
}

window.app = new RafedRecepieApp();