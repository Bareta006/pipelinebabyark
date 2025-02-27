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
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
        }
      } else {
        // Add to hidden slides array
        hiddenSlides.push(slide);
      }
    });
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
      // Reset arrays
      visibleSlides.length = 0;
      hiddenSlides.length = 0;
      
      // Add all slides to visible array
      mediaSlides.forEach(slide => {
        visibleSlides.push(slide);
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
    
    // Remove all slides from the DOM
    mediaSlides.forEach(slide => {
      slide.remove();
    });
    
    // Add visible slides back first, then hidden slides
    visibleSlides.forEach(slide => {
      // Make sure visible slides are actually visible
      slide.style.display = '';
      slide.classList.remove('hide');
      slideshowContainer.appendChild(slide);
    });
    
    hiddenSlides.forEach(slide => {
      // Make sure hidden slides are actually hidden
      slide.style.display = 'none';
      slide.classList.add('hide');
      slideshowContainer.appendChild(slide);
    });

    // If we're in mobile carousel mode, rebuild the carousel
    const isMobile = window.innerWidth < 768;
    
    if (isMobile && slideshowContainer && hasVisibleSlides) {
      // Find the Flickity instance
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshowContainer);
        
        if (flkty) {
          // Destroy the existing carousel
          flkty.destroy();
        }
        
        // Instead of replacing the container, we'll modify its contents
        // First, clear the container
        while (slideshowContainer.firstChild) {
          slideshowContainer.removeChild(slideshowContainer.firstChild);
        }
        
        // Add only the visible slides back to the container
        visibleSlides.forEach(slide => {
          const clonedSlide = slide.cloneNode(true);
          // Make sure the slide is visible
          clonedSlide.style.display = '';
          clonedSlide.classList.remove('hide');
          slideshowContainer.appendChild(clonedSlide);
        });
        
        // Create mobile slider with appropriate options
        const mobileStyle = slideshowContainer.getAttribute('data-slideshow-mobile-style') || 'carousel';
        
        const mobileOptions = {
          autoPlay: false,
          prevNextButtons: false,
          pageDots: mobileStyle === 'slideshow',
          adaptiveHeight: true,
          accessibility: true,
          watchCSS: false,
          wrapAround: true,
          rightToLeft: window.isRTL,
          dragThreshold: mobileStyle === 'carousel' ? 10 : 80,
          contain: mobileStyle !== 'carousel',
          fade: mobileStyle !== 'carousel' && mobileStyle !== 'slideshow'
        };
        
        // Initialize Flickity on the original container with only visible slides
        try {
          new Flickity(slideshowContainer, mobileOptions);
          
          // Prevent any scrolling that might happen
          const originalScrollPos = window.scrollY;
          setTimeout(() => {
            window.scrollTo(0, originalScrollPos);
          }, 10);
        } catch (e) {
          console.error('Error initializing Flickity:', e);
        }
      }
    } else if (!isMobile && slideshowContainer && hasVisibleSlides) {
      // Check if we need to rebuild the desktop slideshow
      const desktopStyle = slideshowContainer.getAttribute('data-slideshow-desktop-style');
      
      if (desktopStyle === 'slideshow') {
        // Find the Flickity instance
        if (typeof Flickity !== 'undefined') {
          const flkty = Flickity.data(slideshowContainer);
          
          if (flkty) {
            // Destroy and recreate the carousel to avoid blank slides
            flkty.destroy();
            
            // Create desktop slider with appropriate options
            const desktopOptions = {
              autoPlay: false,
              prevNextButtons: false,
              pageDots: false,
              adaptiveHeight: true,
              accessibility: true,
              watchCSS: false,
              wrapAround: true,
              rightToLeft: window.isRTL,
              dragThreshold: 80,
              contain: true,
              fade: true
            };
            
            // Recreate the slider
            new Flickity(slideshowContainer, desktopOptions);
            
            // If we have a first visible slide, select it
            if (firstVisibleSlide) {
              const mediaId = firstVisibleSlide.getAttribute('data-media-id');
              if (mediaId) {
                // Prevent the default scrolling behavior that might happen when changing images
                const originalScrollPos = window.scrollY;
                
                slideshowContainer.dispatchEvent(new CustomEvent('theme:image:change', {
                  detail: {
                    id: mediaId
                  }
                }));
                
                // Restore scroll position after image change
                setTimeout(() => {
                  window.scrollTo(0, originalScrollPos);
                }, 10);
              }
            }
          }
        }
      } else {
        // For grid or other non-slideshow modes, we still need to select the first visible slide
        // but we'll prevent any scrolling
        if (firstVisibleSlide) {
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