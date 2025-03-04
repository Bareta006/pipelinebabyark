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
        // Find the image inside the slide structure
        const img = slide.querySelector('img');
        const altText = img ? (img.getAttribute('alt') || '').toLowerCase() : '';
        
        console.log('Storing slide with alt text:', altText);
        
        return {
          element: slide.cloneNode(true),
          altText: altText
        };
      });
      console.log('Saved original slides data for', window.originalSlidesData.length, 'slides');
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
      
      // If Flickity exists, destroy it so we can rebuild with filtered slides
      if (flkty) {
        console.log('Destroying existing Flickity instance');
        flkty.destroy();
      }
    } catch (error) {
      console.error('Error handling Flickity instance:', error);
    }
    
    // 6. Filter slides based on the selected color
    const visibleSlides = [];
    const hiddenSlides = [];
    
    window.originalSlidesData.forEach(slideData => {
      const altText = slideData.altText;
      let isVisible = false; // Default to not visible
      
      console.log('Checking slide with alt text:', altText, 'against color:', selectedColor);
      
      // Check if the alt text contains the selected color
      if (altText && altText.toLowerCase().includes(selectedColor)) {
        isVisible = true;
        console.log('Match found - direct color match');
      } else if (altText.includes('/')) {
        // Handle format like "Eggshell White / Moonlight"
        const colorParts = altText.split('/').map(part => part.trim().toLowerCase());
        if (colorParts.some(part => selectedColor.includes(part) || part.includes(selectedColor))) {
          isVisible = true;
          console.log('Match found - color part match');
        }
      }
      
      // Always include slides with "all" in alt text
      if (altText.includes('all')) {
        isVisible = true;
        console.log('Match found - all');
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
      // 7. Clear the container
      slideshowContainer.innerHTML = '';
      
      // 8. Add the filtered slides to the container
      slidesToShow.forEach(slide => {
        slideshowContainer.appendChild(slide);
      });
      
      // 9. Initialize Flickity with mobile-specific options
      console.log('Initializing Flickity with', slidesToShow.length, 'slides');
      
      // Mobile carousel options based on your requirements
      const mobileOptions = {
        cellAlign: 'center',     // Center alignment
        contain: false,          // Allow peek of next/prev slides
        draggable: true,
        prevNextButtons: false,  // No arrows as requested
        pageDots: false,         // No dots as requested
        adaptiveHeight: false,
        wrapAround: true,        // Infinite scrolling
        freeScroll: false,
        groupCells: false,
        percentPosition: true,
        watchCSS: false,
        rightToLeft: window.isRTL,
        dragThreshold: 10,
        fade: false
      };
      
      new Flickity(slideshowContainer, mobileOptions);
      console.log('Flickity initialized with mobile options');
      
    } catch (error) {
      console.error('Error rebuilding carousel:', error);
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