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
    setTimeout(() => {
      initializeWithSelectedVariant();
    }, 100);
  }
  
  // Listen for the theme's variant change event
  document.addEventListener('theme:variant:change', function(event) {
    if (event.detail && event.detail.variant) {
      // Prevent the default scrolling behavior
      if (event.preventDefault) {
        event.preventDefault();
      }
      
      // Store current scroll position
      const currentScrollPos = window.scrollY;
      
      const productJsonScript = document.querySelector('[data-product-json]');
      if (productJsonScript) {
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          filterImagesByVariantColor(event.detail.variant, productData, false);
          
          // Restore scroll position after filtering
          setTimeout(() => {
            window.scrollTo(0, currentScrollPos);
          }, 100);
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
      // MOBILE HANDLING - Completely rebuild the carousel
      
      // Get the mobile style from the slideshow container
      const mobileStyle = slideshowContainer.getAttribute('data-slideshow-mobile-style') || 'carousel';
      
      // First, destroy the existing Flickity instance if it exists
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshowContainer);
        if (flkty) {
          // Save the current position
          const currentIndex = flkty.selectedIndex;
          
          // Destroy the existing Flickity instance
          flkty.destroy();
          
          // Remove all slides from the DOM
          mediaSlides.forEach(slide => {
            slide.remove();
          });
          
          // Add only visible slides back to the DOM
          visibleSlides.forEach(slide => {
            slideshowContainer.appendChild(slide);
          });
          
          // Create new Flickity instance with mobile options
          setTimeout(() => {
            const mobileOptions = {
              autoPlay: false,
              prevNextButtons: true,
              pageDots: true,
              adaptiveHeight: true,
              accessibility: true,
              watchCSS: false,
              wrapAround: true,
              rightToLeft: window.isRTL,
              dragThreshold: 10,
              contain: false,
              fade: false
            };
            
            // Adjust options based on mobile style
            if (mobileStyle === 'slideshow') {
              mobileOptions.pageDots = true;
              mobileOptions.fade = false;
              mobileOptions.dragThreshold = 10;
            }
            
            // Initialize new Flickity instance
            const newFlkty = new Flickity(slideshowContainer, mobileOptions);
            
            // Select the first slide or maintain the previous index if possible
            if (currentIndex < visibleSlides.length) {
              newFlkty.select(currentIndex);
            } else if (visibleSlides.length > 0) {
              newFlkty.select(0);
            }
            
            // Resize to ensure proper layout
            newFlkty.resize();
          }, 100);
        } else {
          // No existing Flickity instance, just rearrange the DOM
          // Remove all slides from the DOM
          mediaSlides.forEach(slide => {
            slide.remove();
          });
          
          // Add only visible slides back to the DOM
          visibleSlides.forEach(slide => {
            slideshowContainer.appendChild(slide);
          });
          
          // Create new Flickity instance with mobile options
          setTimeout(() => {
            const mobileOptions = {
              autoPlay: false,
              prevNextButtons: true,
              pageDots: true,
              adaptiveHeight: true,
              accessibility: true,
              watchCSS: false,
              wrapAround: true,
              rightToLeft: window.isRTL,
              dragThreshold: 10,
              contain: false,
              fade: false
            };
            
            // Adjust options based on mobile style
            if (mobileStyle === 'slideshow') {
              mobileOptions.pageDots = true;
              mobileOptions.fade = false;
              mobileOptions.dragThreshold = 10;
            }
            
            // Initialize new Flickity instance
            const newFlkty = new Flickity(slideshowContainer, mobileOptions);
            
            // Resize to ensure proper layout
            newFlkty.resize();
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
              // But ONLY if this is not the initial page load
              if (firstVisibleSlide && hasVisibleSlides && !isInitialLoad) {
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
        // But ONLY if this is not the initial page load
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