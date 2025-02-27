/**
 * Variant Image Filter
 * 
 * This script adds functionality to filter product images based on variant color selection.
 * When a color variant is selected, it shows only images with matching alt text and rebuilds
 * the carousel in mobile view to avoid blank slides.
 */

(function() {
  console.log('[Variant Filter] Script initialized');
  
  // Track initial scroll position
  const initialScrollY = window.scrollY;
  console.log('[Variant Filter] Initial scroll position:', initialScrollY);
  
  // Initialize on page load to filter images for the initially selected variant
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[Variant Filter] DOMContentLoaded fired');
    initializeWithSelectedVariant();
  });
  
  // Fallback in case DOMContentLoaded has already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Variant Filter] Document already loaded, state:', document.readyState);
    setTimeout(() => {
      initializeWithSelectedVariant();
    }, 100);
  }
  
  // Listen for the theme's variant change event
  document.addEventListener('theme:variant:change', function(event) {
    console.log('[Variant Filter] Variant change event detected');
    
    if (event.detail && event.detail.variant) {
      // Prevent the default scrolling behavior
      if (event.preventDefault) {
        event.preventDefault();
      }
      
      // Store current scroll position
      const currentScrollPos = window.scrollY;
      console.log('[Variant Filter] Current scroll position before variant change:', currentScrollPos);
      
      const productJsonScript = document.querySelector('[data-product-json]');
      if (productJsonScript) {
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          filterImagesByVariantColor(event.detail.variant, productData, false);
          
          // Restore scroll position after filtering
          setTimeout(() => {
            window.scrollTo(0, currentScrollPos);
            console.log('[Variant Filter] Restored scroll position after variant change');
          }, 100);
        } catch (e) {
          console.error('[Variant Filter] Error parsing product JSON:', e);
        }
      }
    }
  });
  
  // Function to initialize filtering with the initially selected variant
  function initializeWithSelectedVariant() {
    console.log('[Variant Filter] Initializing with selected variant');
    
    const productJsonScript = document.querySelector('[data-product-json]');
    if (!productJsonScript) {
      console.log('[Variant Filter] No product JSON found');
      return;
    }
    
    try {
      const productData = JSON.parse(productJsonScript.textContent);
      
      // Get the initially selected variant
      const selectedVariantId = document.querySelector('[name="id"]')?.value;
      console.log('[Variant Filter] Selected variant ID:', selectedVariantId);
      
      if (selectedVariantId) {
        const selectedVariant = productData.variants.find(v => v.id.toString() === selectedVariantId.toString());
        
        if (selectedVariant) {
          console.log('[Variant Filter] Found selected variant:', selectedVariant.title);
          // Filter images without forcing scroll position
          filterImagesByVariantColor(selectedVariant, productData, true);
        } else {
          console.log('[Variant Filter] Selected variant not found in product data');
        }
      } else {
        // If no variant is explicitly selected, use the first available variant
        if (productData.variants && productData.variants.length > 0) {
          console.log('[Variant Filter] No variant selected, using first available');
          filterImagesByVariantColor(productData.variants[0], productData, true);
        } else {
          console.log('[Variant Filter] No variants available');
        }
      }
    } catch (e) {
      console.error('[Variant Filter] Error parsing product JSON on page load:', e);
    }
  }

  function filterImagesByVariantColor(variant, productData, isInitialLoad = false) {
    console.log('[Variant Filter] Filtering images by variant color, isInitialLoad:', isInitialLoad);
    
    if (!variant || !productData) {
      console.log('[Variant Filter] Missing variant or product data');
      return;
    }

    // Find the color option index
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) {
      console.log('[Variant Filter] No color option found in product options');
      return; // No color option found
    }
    
    const selectedColor = variant.options[colorOptionIndex];
    console.log('[Variant Filter] Selected color:', selectedColor);
    
    if (!selectedColor) {
      console.log('[Variant Filter] No color selected');
      return;
    }

    // Get the slideshow container
    const slideshowContainer = document.querySelector('[data-product-slideshow]');
    
    if (!slideshowContainer) {
      console.log('[Variant Filter] No slideshow container found');
      return;
    }

    // Get all media slides and thumbs
    const mediaSlides = document.querySelectorAll('[data-media-slide]');
    const thumbs = document.querySelectorAll('[data-slideshow-thumbnail]');
    
    console.log('[Variant Filter] Found', mediaSlides.length, 'media slides and', thumbs.length, 'thumbnails');
    
    if (!mediaSlides.length) {
      console.log('[Variant Filter] No media slides found');
      return;
    }

    let hasVisibleSlides = false;
    let firstVisibleSlide = null;
    let visibleSlideCount = 0;

    // Create arrays to hold visible and hidden slides
    const visibleSlides = [];
    const hiddenSlides = [];

    // Filter media slides based on EXACT alt text match only
    mediaSlides.forEach((slide, index) => {
      const altText = slide.getAttribute('aria-label') || '';
      const exactMatch = altText === selectedColor;
      
      console.log(`[Variant Filter] Slide ${index}: alt text "${altText}", match: ${exactMatch}`);
      
      if (exactMatch) {
        // Add to visible slides array
        visibleSlides.push(slide);
        // Show matching slides
        slide.style.display = '';
        slide.classList.remove('hide');
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
          console.log('[Variant Filter] First visible slide found at index', index);
        }
      } else {
        // Add to hidden slides array
        hiddenSlides.push(slide);
        // Hide non-matching slides
        slide.style.display = 'none';
        slide.classList.add('hide');
      }
    });
    
    console.log('[Variant Filter] Visible slides:', visibleSlideCount, 'Hidden slides:', hiddenSlides.length);
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
      console.log('[Variant Filter] No matching slides found, showing all slides as fallback');
      // Reset arrays
      visibleSlides.length = 0;
      hiddenSlides.length = 0;
      
      // Add all slides to visible array and show them
      mediaSlides.forEach(slide => {
        visibleSlides.push(slide);
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
        console.log('[Variant Filter] Filtering thumbnails to match selected color');
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

    // Check if we're in mobile or desktop mode
    const isMobile = window.innerWidth < 768;
    console.log('[Variant Filter] Current view mode:', isMobile ? 'mobile' : 'desktop');
    
    if (isMobile) {
      console.log('[Variant Filter] Handling mobile view');
      // MOBILE HANDLING - Simple approach
      // Just show/hide slides and let the theme handle the carousel
      
      // For mobile, we need to rearrange the DOM to show visible slides first
      // Remove all slides from the DOM
      mediaSlides.forEach(slide => {
        slide.remove();
      });
      
      // Add visible slides back first, then hidden slides
      visibleSlides.forEach(slide => {
        slideshowContainer.appendChild(slide);
      });
      
      hiddenSlides.forEach(slide => {
        slideshowContainer.appendChild(slide);
      });
      
      // Let the theme know we've updated the slides
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshowContainer);
        if (flkty) {
          console.log('[Variant Filter] Resizing mobile Flickity carousel');
          // Just resize the carousel without trying to select slides
          setTimeout(() => {
            flkty.resize();
          }, 100);
        }
      }
    } else {
      console.log('[Variant Filter] Handling desktop view');
      // DESKTOP HANDLING
      // For desktop, we need to rearrange the DOM to show visible slides first
      // This is important for grid layouts and other desktop-specific views
      
      // Check if we need to rebuild the desktop slideshow
      const desktopStyle = slideshowContainer.getAttribute('data-slideshow-desktop-style');
      console.log('[Variant Filter] Desktop slideshow style:', desktopStyle);
      
      if (desktopStyle === 'slideshow') {
        console.log('[Variant Filter] Handling slideshow style');
        // For slideshow style, update the Flickity instance
        if (typeof Flickity !== 'undefined') {
          const flkty = Flickity.data(slideshowContainer);
          if (flkty) {
            console.log('[Variant Filter] Found Flickity instance, resizing');
            // Just resize and select the first visible slide
            setTimeout(() => {
              flkty.resize();
              
              // If we have a visible slide, select it
              // But ONLY if this is not the initial page load
              if (firstVisibleSlide && hasVisibleSlides && !isInitialLoad) {
                const slideIndex = Array.from(slideshowContainer.children).indexOf(firstVisibleSlide);
                if (slideIndex >= 0) {
                  console.log('[Variant Filter] Selecting slide at index', slideIndex);
                  flkty.select(slideIndex);
                }
              } else {
                console.log('[Variant Filter] Not selecting slide - isInitialLoad:', isInitialLoad);
              }
            }, 100);
          }
        }
      } else {
        console.log('[Variant Filter] Handling grid/other style');
        // For grid or other non-slideshow modes, we need to rearrange the DOM
        // to ensure visible slides appear first
        
        // Remove all slides from the DOM
        mediaSlides.forEach(slide => {
          slide.remove();
        });
        
        // Add visible slides back first, then hidden slides
        visibleSlides.forEach(slide => {
          slideshowContainer.appendChild(slide);
        });
        
        hiddenSlides.forEach(slide => {
          slideshowContainer.appendChild(slide);
        });
        
        // If we have a first visible slide, select it
        // But ONLY if this is not the initial page load
        if (firstVisibleSlide && !isInitialLoad) {
          const mediaId = firstVisibleSlide.getAttribute('data-media-id');
          if (mediaId) {
            console.log('[Variant Filter] Dispatching image change event for media ID:', mediaId);
            // Store current scroll position
            const originalScrollPos = window.scrollY;
            console.log('[Variant Filter] Current scroll position before image change:', originalScrollPos);
            
            // THIS IS LIKELY CAUSING THE SCROLL - Dispatch the event to change the image
            // Only do this if not initial load
            slideshowContainer.dispatchEvent(new CustomEvent('theme:image:change', {
              detail: {
                id: mediaId
              }
            }));
            
            // Immediately restore the scroll position
            setTimeout(() => {
              console.log('[Variant Filter] Restoring scroll position to:', originalScrollPos);
              window.scrollTo(0, originalScrollPos);
            }, 10);
          }
        } else {
          console.log('[Variant Filter] Not changing image - isInitialLoad:', isInitialLoad);
        }
      }
    }
    
    console.log('[Variant Filter] Filtering complete');
  }
})(); 