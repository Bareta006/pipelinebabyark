/**
 * Theme Custom JS - Overrides for theme.js functions
 * 
 * This script overrides specific functions in the main theme.js file
 * to prevent unwanted scrolling behavior when variants are selected.
 */

(function() {
  console.log('[Theme Custom] Script initialized');
  
  // Wait for the DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[Theme Custom] DOM loaded, applying overrides');
    
    // Wait a short time to ensure theme.js has initialized
    setTimeout(() => {
      applyOverrides();
    }, 100);
  });
  
  // Apply overrides to theme.js functions
  function applyOverrides() {
    // Find all product slideshow instances
    const slideshows = document.querySelectorAll('[data-product-slideshow]');
    
    if (!slideshows.length) {
      console.log('[Theme Custom] No product slideshows found');
      return;
    }
    
    console.log('[Theme Custom] Found', slideshows.length, 'product slideshows');
    
    // Loop through each slideshow and override its methods
    slideshows.forEach((slideshow, index) => {
      // Get the Flickity instance
      if (typeof Flickity === 'undefined') {
        console.log('[Theme Custom] Flickity not found');
        return;
      }
      
      const flkty = Flickity.data(slideshow);
      if (!flkty) {
        console.log('[Theme Custom] No Flickity instance found for slideshow', index);
        return;
      }
      
      // Find the ProductSlideshow instance in theme.js
      // This is tricky because it's not directly accessible
      // We need to look for it in the DOM element's data
      const slideshowInstance = slideshow._productSlideshow;
      
      if (!slideshowInstance) {
        console.log('[Theme Custom] No ProductSlideshow instance found for slideshow', index);
        return;
      }
      
      // Save the original doImageChange method
      const originalDoImageChange = slideshowInstance.doImageChange;
      
      // Override the doImageChange method
      slideshowInstance.doImageChange = function(event) {
        console.log('[Theme Custom] Intercepted doImageChange call');
        
        // Check if this is an initial page load or has preventScroll flag
        const isInitialLoad = document.readyState !== 'complete';
        const preventScroll = event.detail && event.detail.preventScroll;
        
        if (isInitialLoad || preventScroll) {
          console.log('[Theme Custom] Preventing scroll in doImageChange');
          
          // Call a modified version that doesn't scroll
          var mediaId = event.detail.id;
          this.lastMediaSelect = mediaId;
          const mediaIdString = `[${selectors$q.dataMediaId}="${mediaId}"]`;
          const matchesMedia = (cell) => {
            return cell.element.matches(mediaIdString);
          };
          const index = this.flkty.cells.findIndex(matchesMedia);
          this.flkty.select(index);
          
          // Skip the scrollThumbs call
          console.log('[Theme Custom] Skipped scrollThumbs call');
        } else {
          // Call the original method
          originalDoImageChange.call(this, event);
        }
      };
      
      console.log('[Theme Custom] Successfully overrode doImageChange for slideshow', index);
    });
  }
})(); 