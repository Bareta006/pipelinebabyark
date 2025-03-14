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
          
          // Check if this is a bundle product - if so, skip all filtering
          if (isProductBundle(productData)) {
            //console.log('Bundle product detected, skipping all image filtering');
            return;
          }
          
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
    // Check if we're on a product page by looking for the product gallery div
    const productGallery = document.getElementById('product-gallery-div');
    if (!productGallery) {
      //console.log('Product gallery div not found, not initializing variant image filter');
      return;
    }
    
    const productJsonScript = document.querySelector('[data-product-json]');
    if (productJsonScript) {
      try {
        const productData = JSON.parse(productJsonScript.textContent);
        
        // Debug product data to see what's available
        //console.log('Product type:', productData.type);
        //console.log('Product tags:', productData.tags);
        //console.log('Product handle:', productData.handle);
        
        // Check if this is a bundle product - if so, skip all filtering
        if (isProductBundle(productData)) {
          //console.log('Bundle product detected during initialization, skipping all image filtering');
          return;
        }
        
        // Validate product data structure
        if (!productData) {
          //console.log('Invalid product data: null or undefined');
          return;
        }
        
        if (!productData.variants) {
          //console.log('Product data has no variants array');
          return;
        }
        
        if (!Array.isArray(productData.variants) || productData.variants.length === 0) {
          //console.log('Product variants is not an array or is empty');
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
          //console.log('No valid variant found');
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
        console.error('Error parsing product JSON:', e);
      }
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

  // Function to check if a product is a bundle
  function isProductBundle(productData) {
    if (!productData) {
      //console.log('No product data available for bundle check');
      return false;
    }
    
    // Debug the product data to see what we're working with
    //console.log('Checking if product is a bundle:');
    //console.log('- Product type:', productData.type);
    //console.log('- Product handle:', productData.handle);
    //console.log('- Product tags:', productData.tags);
    
    // Check product handle (most reliable)
    if (productData.handle && typeof productData.handle === 'string' && 
        productData.handle.toLowerCase().includes('bundle')) {
      //console.log('Product handle contains "bundle", skipping image filtering');
      return true;
    }
    
    // Check if product type contains "bundle" (case insensitive)
    if (productData.type && typeof productData.type === 'string' && 
        productData.type.toLowerCase().includes('bundle')) {
      //console.log('Product type contains "bundle", skipping image filtering');
      return true;
    }
    
    // Check product title
    if (productData.title && typeof productData.title === 'string' && 
        productData.title.toLowerCase().includes('bundle')) {
      //console.log('Product title contains "bundle", skipping image filtering');
      return true;
    }
    
    // Check product tags if they exist
    if (productData.tags && Array.isArray(productData.tags)) {
      for (let i = 0; i < productData.tags.length; i++) {
        if (typeof productData.tags[i] === 'string' && 
            productData.tags[i].toLowerCase().includes('bundle')) {
          //console.log('Product has bundle tag, skipping image filtering');
          return true;
        }
      }
    }
    
    // Check URL path as a fallback
    if (window.location.pathname.toLowerCase().includes('bundle')) {
      //console.log('URL path contains "bundle", skipping image filtering');
      return true;
    }
    
    //console.log('Product is not a bundle, proceeding with filtering');
    return false;
  }

  // Function specifically for mobile filtering
  function filterImagesForMobile(variant, productData) {
    console.log('Filtering images for mobile');
    
    // Skip filtering for bundle products
    if (isProductBundle(productData)) {
      return;
    }
    
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
    
    // 2. Get the product gallery div
    const productGallery = document.getElementById('product-gallery-div');
    if (!productGallery) {
      console.log('Product gallery div not found');
      return;
    }
    
    // Get the slideshow container
    const slideshowContainer = productGallery.querySelector('[data-product-slideshow]');
    if (!slideshowContainer) {
      console.log('No slideshow container found in product gallery');
      return;
    }
    
    // 3. Check if we're in mobile mode
    const mobileStyle = slideshowContainer.getAttribute('data-slideshow-mobile-style');
    if (mobileStyle !== 'carousel') {
      console.log('Not a carousel mobile style:', mobileStyle);
      return;
    }
    
    // 4. Get all slides from the product gallery
    const allSlides = productGallery.querySelectorAll('.product__media');
    if (!allSlides || allSlides.length === 0) {
      console.log('No slides found in product gallery');
      return;
    }
    
    console.log('Found', allSlides.length, 'slides in product gallery');
    
    // 5. Get existing Flickity instance
    let flkty = null;
    
    // Check if Flickity is defined
    if (typeof Flickity === 'undefined') {
      console.error('Flickity is not defined. Make sure the library is loaded.');
      return;
    }
    
    try {
      flkty = Flickity.data(slideshowContainer);
      
      // If Flickity exists, destroy it so we can rebuild
      if (flkty) {
        console.log('Destroying existing Flickity instance');
        flkty.destroy();
      }
    } catch (error) {
      console.error('Error with Flickity:', error);
    }
    
    // 6. Create arrays to hold visible and hidden slides
    const visibleSlides = [];
    const hiddenSlides = [];
    
    // 7. Filter slides based on the selected color
    Array.from(allSlides).forEach((slide, index) => {
      const img = slide.querySelector('img');
      const altText = img ? (img.getAttribute('alt') || '') : '';
      
      // Normalize for comparison
      const normalizedAltText = altText.trim().toLowerCase();
      const normalizedSelectedColor = selectedColor.trim().toLowerCase();
      
      console.log(`Slide ${index + 1} alt text:`, normalizedAltText);
      
      let isVisible = false;
      
      // Check for exact match
      if (normalizedAltText === normalizedSelectedColor) {
        isVisible = true;
        console.log('MATCH - Exact match');
      } 
      // Check if alt text contains the color
      else if (normalizedAltText.includes(normalizedSelectedColor)) {
        isVisible = true;
        console.log('MATCH - Contains color');
      }
      // Check if color contains the alt text (reverse check)
      else if (normalizedSelectedColor.includes(normalizedAltText)) {
        isVisible = true;
        console.log('MATCH - Color contains alt text');
      }
      
      // Clone the slide to avoid reference issues
      const clonedSlide = slide.cloneNode(true);
      
      if (isVisible) {
        visibleSlides.push(clonedSlide);
      } else {
        hiddenSlides.push(clonedSlide);
      }
    });
    
    console.log('Filtering results:', visibleSlides.length, 'visible slides,', hiddenSlides.length, 'hidden slides');
    
    // 8. If no visible slides, show all slides
    const slidesToShow = visibleSlides.length > 0 ? visibleSlides : Array.from(allSlides).map(slide => slide.cloneNode(true));
    
    if (visibleSlides.length === 0) {
      console.log('No matching slides found, showing all slides instead');
    }
    
    // 9. Clear the slideshow container
    slideshowContainer.innerHTML = '';
    
    // 10. Add the filtered slides to the container
    slidesToShow.forEach(slide => {
      slideshowContainer.appendChild(slide);
    });
    
    // 11. Initialize a new Flickity instance
    try {
      console.log('Creating new Flickity instance with', slidesToShow.length, 'slides');
      new Flickity(slideshowContainer, {
        cellAlign: 'center',
        wrapAround: true,
        contain: true,
        draggable: true,
        prevNextButtons: false,
        pageDots: true,
        adaptiveHeight: false
      });
      console.log('Flickity initialized successfully');
    } catch (error) {
      console.error('Error initializing Flickity:', error);
    }
  }

  // Function specifically for desktop filtering
  function filterImagesForDesktop(variant, productData, isInitialLoad = false) {
    //console.log('Filtering images for desktop');
    
    // Skip filtering for bundle products
    if (isProductBundle(productData)) {
      return;
    }

    if (!variant || !productData) return;

    // Find the color option index
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) return; // No color option found
    
    const selectedColor = variant.options[colorOptionIndex];
    
    if (!selectedColor) return;

    // Get the product gallery div FIRST - this is the container for everything
    const productGallery = document.getElementById('product-gallery-div');
    if (!productGallery) {
      //console.log('Product gallery div not found');
      return;
    }
    
    // Get the slideshow container WITHIN the product gallery
    const slideshowContainer = productGallery.querySelector('[data-product-slideshow]');
    if (!slideshowContainer) {
      //console.log('No slideshow container found in product gallery');
      return;
    }

    // Get all media slides and thumbs - ONLY from within the product gallery
    const mediaSlides = productGallery.querySelectorAll('[data-media-slide]');
    // Thumbs should also be scoped to the product gallery
    const thumbs = productGallery.querySelectorAll('[data-slideshow-thumbnail]');
    
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