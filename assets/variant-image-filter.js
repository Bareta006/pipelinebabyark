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
    if (!productJsonScript) {
      console.log('No product JSON script found');
      return;
    }
    
    try {
      // Check if the script content is empty or invalid
      if (!productJsonScript.textContent || productJsonScript.textContent.trim() === '') {
        console.log('Product JSON script is empty');
        return;
      }
      
      const productData = JSON.parse(productJsonScript.textContent);
      
      // Validate product data structure
      if (!productData) {
        console.log('Invalid product data: null or undefined');
        return;
      }
      
      if (!productData.variants) {
        console.log('Product data has no variants array');
        return;
      }
      
      if (!Array.isArray(productData.variants) || productData.variants.length === 0) {
        console.log('Product variants is not an array or is empty');
        return;
      }
      
      // Get the initially selected variant
      const variantSelector = document.querySelector('[name="id"]');
      const selectedVariantId = variantSelector?.value;
      
      let selectedVariant = null;
      
      if (selectedVariantId) {
        selectedVariant = productData.variants.find(v => 
          v && v.id && v.id.toString() === selectedVariantId.toString()
        );
      }
      
      // If no variant is explicitly selected or found, use the first available variant
      if (!selectedVariant && productData.variants.length > 0) {
        selectedVariant = productData.variants[0];
      }
      
      if (!selectedVariant) {
        console.log('No valid variant found');
        return;
      }
      
      // Check if we're in mobile or desktop mode
      const isMobile = window.innerWidth < 768;
      
      if (isMobile) {
        filterImagesForMobile(selectedVariant, productData);
      } else {
        filterImagesForDesktop(selectedVariant, productData, true);
      }
    } catch (e) {
      console.error('Error parsing product JSON on page load:', e);
    }
  }

  // Helper function to get the color option name from product data
  function getColorOptionName(productData) {
    if (!productData) return null;
    if (!productData.options || !Array.isArray(productData.options)) return null;
    
    // Look for option names containing 'color' or 'colour'
    const colorOptionIndex = productData.options.findIndex(option => 
      option && typeof option === 'string' && 
      (option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'))
    );
    
    if (colorOptionIndex !== -1) {
      return productData.options[colorOptionIndex];
    }
    
    return null;
  }

  // Function specifically for mobile filtering
  function filterImagesForMobile(variant, productData) {
    console.log('Mobile filtering started');
    
    // Validate inputs
    if (!variant || !productData) {
      console.log('Invalid variant or product data');
      return;
    }
    
    // 1. Find the color option index and value
    if (!productData.options || !Array.isArray(productData.options)) {
      console.log('Product options not found or not an array');
      return;
    }
    
    const colorOptionIndex = productData.options.findIndex(option => 
      option && typeof option === 'string' && 
      (option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'))
    );
    
    if (colorOptionIndex === -1) {
      console.log('No color option found');
      return; // No color option found
    }
    
    // Ensure variant has options array
    if (!variant.options || !Array.isArray(variant.options) || colorOptionIndex >= variant.options.length) {
      console.log('Variant options not found or invalid index');
      return;
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
    
    // 4. Store original slides if needed (only once)
    if (!window.originalSlidesData) {
      const allSlides = slideshowContainer.querySelectorAll('.product__media');
      window.originalSlidesData = Array.from(allSlides).map(slide => {
        const img = slide.querySelector('img');
        return {
          element: slide.cloneNode(true),
          altText: img ? (img.getAttribute('alt') || '').toLowerCase() : ''
        };
      });
      console.log('Saved original slides data');
    }
    
    // 5. Get existing Flickity instance or create a new one
    let flkty = null;
    
    // Check if Flickity is defined
    if (typeof Flickity === 'undefined') {
      console.error('Flickity is not defined. Make sure the library is loaded.');
      return;
    }
    
    try {
      flkty = Flickity.data(slideshowContainer);
      
      // If Flickity doesn't exist yet, initialize it
      if (!flkty) {
        console.log('Creating new Flickity instance');
        flkty = new Flickity(slideshowContainer, {
          cellAlign: 'center',
          contain: true,
          draggable: true,
          prevNextButtons: false,
          pageDots: false,
          adaptiveHeight: false
        });
      } else {
        console.log('Using existing Flickity instance');
      }
    } catch (error) {
      console.error('Error initializing Flickity:', error);
      return;
    }
    
    // 6. Filter slides based on the selected color
    const visibleSlides = [];
    const hiddenSlides = [];
    
    window.originalSlidesData.forEach(slideData => {
      const altText = slideData.altText;
      let isVisible = true;
      
      // Check for #color format in alt text
      if (altText.includes('#')) {
        const parts = altText.split('#');
        if (parts.length > 1) {
          const colorPart = parts[1].split(' ')[0].toLowerCase();
          isVisible = (colorPart === selectedColor || colorPart === 'all');
        }
      }
      
      if (isVisible) {
        visibleSlides.push(slideData.element.cloneNode(true));
      } else {
        hiddenSlides.push(slideData.element.cloneNode(true));
      }
    });
    
    console.log('Filtered slides:', visibleSlides.length, 'visible,', hiddenSlides.length, 'hidden');
    
    // If no visible slides, show all slides
    const slidesToShow = visibleSlides.length > 0 ? visibleSlides : window.originalSlidesData.map(data => data.element.cloneNode(true));
    
    try {
      // 7. Remove all cells from Flickity
      if (flkty.cells && flkty.cells.length > 0) {
        const cellElements = flkty.getCellElements();
        if (cellElements && cellElements.length > 0) {
          flkty.remove(cellElements);
          console.log('Removed all existing cells');
        }
      }
      
      // 8. Add the filtered slides to Flickity
      if (slidesToShow.length > 0) {
        slidesToShow.forEach(slide => {
          flkty.append(slide);
        });
        console.log('Added', slidesToShow.length, 'slides to Flickity');
      } else {
        console.warn('No slides to show');
      }
      
      // 9. Update Flickity to reflect changes
      flkty.reloadCells();
      flkty.resize();
      flkty.updateDraggable();
      
      // 10. Go to first cell
      if (flkty.cells && flkty.cells.length > 0) {
        flkty.select(0, false, true);
      }
      
      console.log('Flickity updated with filtered slides');
    } catch (error) {
      console.error('Error updating Flickity:', error);
      
      // Fallback: If Flickity operations fail, try to rebuild it from scratch
      try {
        // Destroy the existing instance
        if (flkty) {
          flkty.destroy();
        }
        
        // Clear the container
        slideshowContainer.innerHTML = '';
        
        // Add all slides back
        slidesToShow.forEach(slide => {
          slideshowContainer.appendChild(slide);
        });
        
        // Create a new instance
        new Flickity(slideshowContainer, {
          cellAlign: 'left',
          contain: true,
          draggable: true,
          prevNextButtons: true,
          pageDots: true,
          adaptiveHeight: false
        });
        
        console.log('Rebuilt Flickity from scratch after error');
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
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