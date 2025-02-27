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
          // Filter images first
          filterImagesByVariantColor(selectedVariant, productData);
          
          // After filtering, ensure we're at the top of the page
          // Use a small delay to let the browser finish rendering
          setTimeout(() => {
            window.scrollTo({
              top: 0,
              behavior: 'auto' // Use 'auto' instead of 'smooth' to avoid animation
            });
          }, 50);
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
        slide.classList.remove('hide'); // Also remove hide class just in case
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
        }
      } else {
        // Hide non-matching slides
        slide.style.display = 'none';
        slide.classList.add('hide'); // Also add hide class for compatibility
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
      return;
    }
    
    // Rearrange slides so visible ones appear first
    // Create arrays to hold visible and hidden slides
    const visibleSlides = [];
    const hiddenSlides = [];
    
    // Sort slides into visible and hidden arrays
    mediaSlides.forEach(slide => {
      if (slide.style.display === 'none') {
        hiddenSlides.push(slide);
      } else {
        visibleSlides.push(slide);
      }
    });
    
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

    // If we're in mobile carousel mode, rebuild the carousel
    const isMobile = window.innerWidth < 768;
    
    if (isMobile && slideshowContainer && hasVisibleSlides) {
      // Find the Flickity instance
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshowContainer);
        
        if (flkty) {
          // Destroy and recreate the carousel to avoid blank slides
          flkty.destroy();
          
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
          
          // Recreate the slider
          new Flickity(slideshowContainer, mobileOptions);
          
          // If we have a first visible slide, select it
          if (firstVisibleSlide) {
            const mediaId = firstVisibleSlide.getAttribute('data-media-id');
            if (mediaId) {
              slideshowContainer.dispatchEvent(new CustomEvent('theme:image:change', {
                detail: {
                  id: mediaId
                }
              }));
            }
          }
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
                slideshowContainer.dispatchEvent(new CustomEvent('theme:image:change', {
                  detail: {
                    id: mediaId
                  }
                }));
              }
            }
          }
        }
      }
    }
  }
})(); 