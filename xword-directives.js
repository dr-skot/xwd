angular.module('xwordApp')

  .directive('visibleWhenLit', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        scope.$watch(function() { return element.hasClass('lit') }, function() {
          if (element.hasClass('lit')) {
            var scroller = document.getElementById(attrs.visibleWhenLit);
            if (scroller) scroller.scrollTop = element[0].offsetTop;
          }
        });
      }
    };
  })

  .directive('alignWith', function () {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        function align() {
          var anchor = document.getElementById(attrs.alignWith);
          //console.log('align with', anchor);
          if (anchor) {
            element[0].style.left = anchor.offsetLeft + 'px';
            element[0].style.top = anchor.offsetTop + 'px';
            document.getElementById('rebusInput').focus(); // TODO decouple this
          }
        }
        // TODO general version should also watch alignWith attr
        scope.$watch(function() { return element.attr('class') }, function(newValue) {
          if (!newValue || !newValue.match(/ng-hide/)) align();
        });
      }
    };
  })

  // shrink an element's font size to make it fit width of parent element
  // element is assumed to contain only text, so that font size and element width will vary in direct proportion
  // does not *grow* to fit: (computed) font size of parent is max font size applied
  .directive('fitText', function() {
    return {
      restrict: 'A',
      link: function (scope, element, attrs) {
        scope.$watch(function() { return element.html() }, function(newValue) {
          var text = element[0], box = element.parent()[0],
            textWidth = text.offsetWidth, boxWidth = box.offsetWidth - 4,// TODO justify this 4 2px margin? should it be proportional
            csText = getComputedStyle(text), csBox = getComputedStyle(box);

          if (csText.fontSize === csBox.fontSize && textWidth <= boxWidth) {
            console.log('size ok');
          } else {
              var newFontSize = parseInt(csText.fontSize) * boxWidth / textWidth;
              console.log('newFontSize', newFontSize);
              text.style.fontSize = Math.min(newFontSize, parseInt(csBox.fontSize)) + 'px';
          }
        });
      }
    };
  })


  // adapted from http://jsfiddle.net/lsiv568/fsfPe/10/
  .directive('dropzone', function() {
  return {
    restrict: 'A',
    scope: {
      fileData: '='
    },
    link: function(scope, element, attrs) {
      var checkSize, isTypeValid, processDragOverOrEnter;

      processDragOverOrEnter = function(event) {
        event.preventDefault();
        event.dataTransfer.effectAllowed = 'copy';
        return false;
      };

      checkSize = function(size) {
        var maxSize = (attrs.maxSize ? parseFloat(attrs.maxSize) : 1),
          valid = size / (1024 * 1024) < maxSize;
        // TODO let user provide error handling
        if (!valid) alert("File must be smaller than " + maxSize + " MB");
        return valid;
      };

      isTypeValid = function(type) {
        var valid = !attrs.mimeTypes || attrs.mimeTypes.indexOf(type) > -1;
        // TODO let user provide error handling
        if (!valid) alert('Invalid file type: ' + type + '\nFile must be one of ' + attrs.mimeTypes);
        return valid;
      };

      element.bind('dragover', processDragOverOrEnter);
      element.bind('dragenter', processDragOverOrEnter);

      return element.bind('drop', function(dropEvent) {
        dropEvent.preventDefault();
        var file = dropEvent.dataTransfer.files[0];
        if (checkSize(file.size) && isTypeValid(file.type)) {
          var reader = new FileReader();
          reader.onload = function(loadEvent) {
            return scope.$apply(function() {
              scope.fileData = loadEvent.target.result;
            });
          };
          reader.readAsArrayBuffer(file);
        }
        return false;
      });
    }
  };
});
