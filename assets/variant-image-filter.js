/**
 * Variant Image Filter
 * 
 * This script adds functionality to filter product images based on variant color selection.
 * When a color variant is selected, it shows only images with matching alt text and rebuilds
 * the carousel in mobile view to avoid blank slides.
 */

(function() {
  // Initialize on page load to filter images for the initially selected variant
  document.addEventListener('DOMContentLoaded', function() {
    initializeWithSelectedVariant();
  });
  
  // Fallback in case DOMContentLoaded has already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeWithSelectedVariant, 100);
  }
  
  // Listen for the theme's variant change event
  document.addEventListener('theme:variant:change', function(event) {
    if (event.detail && event.detail.variant) {
      // Prevent the default scrolling behavior
      if (event.preventDefault) {
        event.preventDefault();
      }
      
      // Also try to prevent any scrolling that might happen after the variant change
      setTimeout(() => {
        // Store current scroll position
        const currentScrollPos = window.scrollY;
        
        // Set up a scroll event listener to maintain the scroll position
        const preventScroll = () => {
          window.scrollTo(0, currentScrollPos);
        };
        
        // Add the listener
        window.addEventListener('scroll', preventScroll, { once: true });
        
        // Remove it after a short delay
        setTimeout(() => {
          window.removeEventListener('scroll', preventScroll);
        }, 500);
      }, 10);
      
      const productJsonScript = document.querySelector('[data-product-json]');
      if (productJsonScript) {
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          filterImagesByVariantColor(event.detail.variant, productData);
        } catch (e) {
          console.error('Error parsing product JSON:', e);
        }
      }
    }
  });
  
  // Function to initialize filtering with the initially selected variant
  function initializeWithSelectedVariant() {
    const productJsonScript = document.querySelector('[data-product-json]');
    if (!productJsonScript) return;
    
    try {
      const productData = JSON.parse(productJsonScript.textContent);
      
      // Get the initially selected variant
      const selectedVariantId = document.querySelector('[name="id"]')?.value;
      
      if (selectedVariantId) {
        const selectedVariant = productData.variants.find(v => v.id.toString() === selectedVariantId.toString());
        
        if (selectedVariant) {
          // Filter images without forcing scroll position
          filterImagesByVariantColor(selectedVariant, productData);
        }
      } else {
        // If no variant is explicitly selected, use the first available variant
        if (productData.variants && productData.variants.length > 0) {
          filterImagesByVariantColor(productData.variants[0], productData);
        }
      }
    } catch (e) {
      console.error('Error parsing product JSON on page load:', e);
    }
  }

  function filterImagesByVariantColor(variant, productData) {
    if (!variant || !productData) return;

    // Find the color option index
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) return; // No color option found
    
    const selectedColor = variant.options[colorOptionIndex];
    
    if (!selectedColor) return;

    // Get the slideshow container
    const slideshowContainer = document.querySelector('[data-product-slideshow]');
    
    if (!slideshowContainer) return;

    // Get all media slides and thumbs
    const mediaSlides = document.querySelectorAll('[data-media-slide]');
    const thumbs = document.querySelectorAll('[data-slideshow-thumbnail]');
    
    if (!mediaSlides.length) return;

    let hasVisibleSlides = false;
    let firstVisibleSlide = null;
    let visibleSlideCount = 0;

    // Filter media slides based on EXACT alt text match only
    mediaSlides.forEach((slide) => {
      const altText = slide.getAttribute('aria-label') || '';
      const exactMatch = altText === selectedColor;
      
      if (exactMatch) {
        // Show matching slides
        slide.style.display = '';
        slide.classList.remove('hide');
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
        }
      } else {
        // Hide non-matching slides
        slide.style.display = 'none';
        slide.classList.add('hide');
      }
    });
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
      mediaSlides.forEach(slide => {
        slide.style.display = '';
        slide.classList.remove('hide');
      });
      
      if (thumbs.length) {
        thumbs.forEach(thumb => {
          thumb.style.display = '';
        });
      }
    } else {
      // Filter thumbnails to match
      if (thumbs.length) {
        thumbs.forEach(thumb => {
          const altText = thumb.getAttribute('aria-label') || '';
          const exactMatch = altText === selectedColor;
          
          if (exactMatch) {
            thumb.style.display = '';
          } else {
            thumb.style.display = 'none';
          }
        });
      }
    }

    // After filtering, we need to:
    // 1. Trigger a resize on any existing Flickity instance
    // 2. Select the first visible slide
    // 3. Let the theme know we've changed the slides
    
    // Wait a moment for the DOM to update
    setTimeout(() => {
      // If we have a first visible slide, select it using the theme's event system
      if (firstVisibleSlide && hasVisibleSlides) {
        const mediaId = firstVisibleSlide.getAttribute('data-media-id');
        if (mediaId) {
          // Store current scroll position
          const originalScrollPos = window.scrollY;
          
          // Dispatch the event to change the image - this uses the theme's built-in handling
          slideshowContainer.dispatchEvent(new CustomEvent('theme:image:change', {
            detail: {
              id: mediaId
            }
          }));
          
          // Immediately restore the scroll position
          setTimeout(() => {
            window.scrollTo(0, originalScrollPos);
          }, 10);
        }
      }
      
      // If Flickity is initialized, tell it to resize and reposition
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshowContainer);
        if (flkty) {
          // Force a resize to update the carousel
          flkty.resize();
          
          // For mobile, always select the first slide (index 0)
          if (window.innerWidth < 768) {
            flkty.select(0, false, true);
          }
        }
      }
      
      // Trigger a window resize event to help any responsive elements adjust
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }
})(); 