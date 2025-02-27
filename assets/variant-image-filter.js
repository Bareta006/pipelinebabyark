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
          filterImagesByVariantColor(event.detail.variant, productData, false);
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
          filterImagesByVariantColor(selectedVariant, productData, true);
        }
      } else {
        // If no variant is explicitly selected, use the first available variant
        if (productData.variants && productData.variants.length > 0) {
          filterImagesByVariantColor(productData.variants[0], productData, true);
        }
      }
    } catch (e) {
      console.error('Error parsing product JSON on page load:', e);
    }
  }

  function filterImagesByVariantColor(variant, productData, isInitialLoad = false) {
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

    // Create arrays to hold visible and hidden slides
    const visibleSlides = [];
    const hiddenSlides = [];

    // Filter media slides based on EXACT alt text match only
    mediaSlides.forEach((slide) => {
      const altText = slide.getAttribute('aria-label') || '';
      const exactMatch = altText === selectedColor;
      
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
        }
      } else {
        // Add to hidden slides array
        hiddenSlides.push(slide);
        // Hide non-matching slides
        slide.style.display = 'none';
        slide.classList.add('hide');
      }
    });
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
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
    
    if (isMobile) {
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
          // Just resize the carousel without trying to select slides
          setTimeout(() => {
            flkty.resize();
          }, 100);
        }
      }
    } else {
      // DESKTOP HANDLING
      // For desktop, we need to rearrange the DOM to show visible slides first
      // This is important for grid layouts and other desktop-specific views
      
      // Check if we need to rebuild the desktop slideshow
      const desktopStyle = slideshowContainer.getAttribute('data-slideshow-desktop-style');
      
      if (desktopStyle === 'slideshow') {
        // For slideshow style, update the Flickity instance
        if (typeof Flickity !== 'undefined') {
          const flkty = Flickity.data(slideshowContainer);
          if (flkty) {
            // Just resize and select the first visible slide
            setTimeout(() => {
              flkty.resize();
              
              // If we have a visible slide, select it
              if (firstVisibleSlide && hasVisibleSlides) {
                const slideIndex = Array.from(slideshowContainer.children).indexOf(firstVisibleSlide);
                if (slideIndex >= 0) {
                  flkty.select(slideIndex);
                }
              }
            }, 100);
          }
        }
      } else {
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
        if (firstVisibleSlide && !isInitialLoad) {
          const mediaId = firstVisibleSlide.getAttribute('data-media-id');
          if (mediaId) {
            // Store current scroll position
            const originalScrollPos = window.scrollY;
            
            // Dispatch the event to change the image
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
      }
    }
  }
})(); 