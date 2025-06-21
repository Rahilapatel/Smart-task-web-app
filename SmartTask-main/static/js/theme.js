document.addEventListener('DOMContentLoaded', function() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // Check for saved theme preference or use the browser setting as default
    const savedTheme = localStorage.getItem('theme') || 
                       (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    // Apply the theme
    applyTheme(savedTheme);
    
    // Add event listener for theme toggle button
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function() {
            const currentTheme = htmlElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            // Show toggle animation
            animateThemeToggle(currentTheme, newTheme);
            
            // Apply theme after a short animation delay
            setTimeout(() => {
                applyTheme(newTheme);
                
                // Send to server to save in cookies too
                saveThemePreference(newTheme);
            }, 150);
        });
    }
    
    /**
     * Apply the given theme to the document with enhanced transitions
     */
    function applyTheme(theme) {
        // Apply theme to root element
        htmlElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update all theme-dependent elements
        document.querySelectorAll('[data-theme-update]').forEach(element => {
            const updateType = element.getAttribute('data-theme-update');
            if (updateType === 'class') {
                if (theme === 'dark') {
                    element.classList.add('dark-theme');
                    element.classList.remove('light-theme');
                } else {
                    element.classList.add('light-theme');
                    element.classList.remove('dark-theme');
                }
            }
        });
        
        // Update icon in the theme toggle button
        if (themeToggleBtn) {
            // Add new icon based on theme
            if (theme === 'dark') {
                themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
                themeToggleBtn.setAttribute('title', 'Switch to light mode');
                themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
            } else {
                themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
                themeToggleBtn.setAttribute('title', 'Switch to dark mode');
                themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
            }
        }
        
        // Trigger a custom event that other scripts can listen for
        const themeChangeEvent = new CustomEvent('themeChanged', { detail: { theme: theme } });
        document.dispatchEvent(themeChangeEvent);
    }
    
    /**
     * Animate the theme toggle transition
     */
    function animateThemeToggle(oldTheme, newTheme) {
        if (!themeToggleBtn) return;
        
        // Add transition class
        themeToggleBtn.classList.add('theme-transition');
        
        // Create and add a temporary overlay for transition effect
        const overlay = document.createElement('div');
        overlay.classList.add('theme-transition-overlay');
        document.body.appendChild(overlay);
        
        // Trigger animation
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
        
        // Remove overlay after animation completes
        setTimeout(() => {
            overlay.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(overlay);
                themeToggleBtn.classList.remove('theme-transition');
            }, 300);
        }, 450);
    }
    
    /**
     * Save theme preference to server via fetch
     */
    function saveThemePreference(theme) {
        const formData = new FormData();
        formData.append('theme', theme);
        
        fetch('/toggle-theme', {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Theme preference saved successfully');
            }
        })
        .catch(error => {
            console.error('Error saving theme preference:', error);
        });
    }
    
    // Listen for system color scheme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        const newTheme = e.matches ? 'dark' : 'light';
        applyTheme(newTheme);
        saveThemePreference(newTheme);
    });
});
