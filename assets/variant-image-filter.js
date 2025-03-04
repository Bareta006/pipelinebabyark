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
          
          // Check if we're in mobile or desktop mode
          const isMobile = window.innerWidth < 768;
          
          if (isMobile) {
            filterImagesForMobile(event.detail.variant, productData);
          } else {
            filterImagesForDesktop(event.detail.variant, productData, false);
          }
          
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
          // Check if we're in mobile or desktop mode
          const isMobile = window.innerWidth < 768;
          
          if (isMobile) {
            filterImagesForMobile(selectedVariant, productData);
          } else {
            filterImagesForDesktop(selectedVariant, productData, true);
          }
        }
      } else {
        // If no variant is explicitly selected, use the first available variant
        if (productData.variants && productData.variants.length > 0) {
          // Check if we're in mobile or desktop mode
          const isMobile = window.innerWidth < 768;
          
          if (isMobile) {
            filterImagesForMobile(productData.variants[0], productData);
          } else {
            filterImagesForDesktop(productData.variants[0], productData, true);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing product JSON on page load:', e);
    }
  }

  // Helper function to get the color option name from product data
  function getColorOptionName(productData) {
    if (!productData || !productData.options) return null;
    
    // Look for option names containing 'color' or 'colour'
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex !== -1) {
      return productData.options[colorOptionIndex];
    }
    
    return null;
  }

  // Function specifically for mobile filtering
  function filterImagesForMobile(variant, productData) {
    console.log('Mobile filtering started');
    
    // 1. Find the color option index and value
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) {
      console.log('No color option found');
      return; // No color option found
    }
    
    const selectedColor = variant.options[colorOptionIndex].toLowerCase();
    console.log('Selected color:', selectedColor);
    
    // 2. Get the slideshow container
    const slideshowContainer = document.querySelector('[data-product-slideshow]');
    if (!slideshowContainer) {
      console.log('No slideshow container found');
      return;
    }
    
    // 3. Check if we're in mobile mode
    const mobileStyle = slideshowContainer.getAttribute('data-slideshow-mobile-style');
    if (mobileStyle !== 'carousel') {
      console.log('Not a carousel mobile style:', mobileStyle);
      return;
    }
    
    // 4. Create or get our slide storage if it doesn't exist
    let slideStorage = document.getElementById('variant-image-storage');
    if (!slideStorage) {
      // First time - we need to save all original slides
      slideStorage = document.createElement('div');
      slideStorage.id = 'variant-image-storage';
      slideStorage.style.display = 'none';
      document.body.appendChild(slideStorage);
      
      // Get all original slides and store copies in our storage
      const originalSlides = slideshowContainer.querySelectorAll('.product__media');
      originalSlides.forEach(slide => {
        const clone = slide.cloneNode(true);
        slideStorage.appendChild(clone);
      });
      
      console.log('Created slide storage with', slideStorage.children.length, 'slides');
    }
    
    // 5. Destroy the existing Flickity instance if it exists
    if (typeof Flickity !== 'undefined') {
      const flkty = Flickity.data(slideshowContainer);
      if (flkty) {
        console.log('Destroying existing Flickity instance');
        flkty.destroy();
      }
    }
    
    // 6. Remove all current slides from the slideshow container
    const currentSlides = slideshowContainer.querySelectorAll('.product__media');
    currentSlides.forEach(slide => slide.remove());
    
    // 7. Get all stored slides that match the selected color
    const storedSlides = slideStorage.querySelectorAll('.product__media');
    const matchingSlides = [];
    
    storedSlides.forEach(slide => {
      const img = slide.querySelector('img');
      if (!img) return;
      
      const altText = (img.getAttribute('alt') || '').toLowerCase();
      
      // Check for #color format in alt text
      if (altText.includes('#')) {
        const parts = altText.split('#');
        if (parts.length > 1) {
          const colorPart = parts[1].split(' ')[0].toLowerCase();
          if (colorPart === selectedColor || colorPart === 'all') {
            matchingSlides.push(slide);
          }
        }
      } else {
        // If no color format, include it (default behavior)
        matchingSlides.push(slide);
      }
    });
    
    console.log('Found', matchingSlides.length, 'matching slides for color:', selectedColor);
    
    // 8. If no matching slides, use all slides
    const slidesToShow = matchingSlides.length > 0 ? matchingSlides : Array.from(storedSlides);
    
    // 9. Add clones of the matching slides to the slideshow container
    slidesToShow.forEach(slide => {
      const clone = slide.cloneNode(true);
      slideshowContainer.appendChild(clone);
    });
    
    // 10. Let the theme reinitialize Flickity
    setTimeout(() => {
      console.log('Triggering resize to reinitialize Flickity');
      window.dispatchEvent(new Event('resize'));
      
      // Check if Flickity was reinitialized
      setTimeout(() => {
        const newFlkty = Flickity.data(slideshowContainer);
        if (!newFlkty) {
          console.log('Flickity not reinitialized by theme, trying manual initialization');
          
          // Try to manually initialize Flickity
          try {
            new Flickity(slideshowContainer, {
              cellAlign: 'left',
              contain: false,
              draggable: '>1',
              prevNextButtons: true,
              pageDots: true,
              adaptiveHeight: false,
              wrapAround: false
            });
            console.log('Manual Flickity initialization successful');
          } catch (error) {
            console.error('Error manually initializing Flickity:', error);
          }
        } else {
          console.log('Flickity successfully reinitialized by theme');
        }
      }, 300);
    }, 100);
  }

  // Function specifically for desktop filtering
  function filterImagesForDesktop(variant, productData, isInitialLoad = false) {
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
        slide.style.visibility = 'visible';
        slide.style.position = 'relative';
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
})(); 