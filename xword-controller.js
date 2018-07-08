angular.module('xwordApp')
  .controller('XwordController', function($scope, $interval, $window, $document, XwordService) {

    var xwd = XwordService,
      ACROSS = xwd.ACROSS,
      DOWN = xwd.DOWN,

      puzzle,             // the puzzle
      numbers,            // for each cell the number label that goes in it if any TODO move to inside puzzle
      direction = ACROSS, // current direction user is working in, ACROSS or DOWN
      currentClues = {across: null, down: null}, // clues for the current cursor position

      focus = [],
      selection,

      timer,
      undos;


    $scope.ACROSS = ACROSS;
    $scope.DOWN = DOWN;

    $scope.direction = function() { return direction };

    $scope.rebus = '';

    //TODO support pause
    //TODO autopause when leaving page

    //TODO center current clue vertically
    //TODO current clue should show A or D
    //TODO dynamic sizing with max/min grid dimensions and max/min cell dimensions
    //TODO style title etc
    //TODO toolbar with reset, rebus, settings
    //TODO codify cursor behavior like NY Times

    //TODO allow user-numbering with diagramless puzzle
    //TODO better styling of selection
    //TODO disable selecting when not in diagramless mode
    //TODO disable other activities while in selection mode
    //TODO disable rebus on click elsewhere
    //TODO style rebus
    //TODO select with click-drag

    //TODO tab to next word
    //TODO move everything out of $scope except what's used by html
    //TODO manage focus
    //TODO call xwd.isSolved only in one place, and use checkBlacks option if diagramless

    // TODO where should these go?
    // always-positive modulo
    Number.prototype.mod = function(n) {
      return ((this % n) + n) % n;
    };
    Number.prototype.isInRange = function(a, b) {
      return a < b ? this >= a && this <= b : this >= b && this <= a;
    };

    // watch for dragged-on puzzle
    $scope.$watch('draggedPuzzle', function(newValue) {
      if (newValue) {
        var p = xwd.puzzleFromFileData(newValue);
        setPuzzle({puzzle: p});
      }
    });

    $scope.$watch('isDiagramless', function(newValue, oldValue) {
      if (newValue !== oldValue) {
        renumber();
        validateCursor();
      }
    });

    function validateCursor() {
      if (!$scope.isDiagramless && xwd.isBlack(getGrid(), $scope.cursor)) {
        advanceCursor(1, direction);
      } else {
        setCursor($scope.cursor);
      }
    }

    function loadValues() {
      // TODO version check it
      var xword = $window.localStorage.getItem('xword');
      xword = JSON.parse(xword);
      if (!xword) xword = {};
      setPuzzle(xword);
      //setPuzzle({puzzle: null})
    }

    function setPuzzle(xword) {
      puzzle = xword.puzzle;
      $scope.puzzle = puzzle;
      $scope.cursor = xword.cursor || 0;
      $scope.time = xword.time || 0;
      undos = xword.undos || [];
      if (puzzle) {
        //console.log('puzzle', puzzle);
        $scope.solved = xwd.isSolved($scope.puzzle);
        renumber();
        validateCursor();
        if (!$scope.solved) startTimer();
      }
    }

    function storeValues() {
      var s = $scope;
      var xword = { puzzle: s.puzzle, cursor: s.cursor, time: s.time, undos: undos };
      $window.localStorage.setItem('xword', JSON.stringify(xword));
      //console.log('storeValues %O', JSON.stringify(xword));
    }

    function startTimer() {
      $interval.cancel(timer);
      timer = $interval(function() {
        $scope.time += 1;
        storeValues();
      }, 1000);
    }

    // TODO move to service
    function guess(k, x) {
      var puz = $scope.puzzle;
      if (x != puz.guesses[k]) {
        undos.push({ action:'guess', k: k, guess: (puz.guesses[k]) });
        puz.guesses[k] = x;
        recordChange();
        renumber(); // TODO only if black changes
      }
    }

    function recordChange() {
      storeValues();
      if (xwd.isSolved($scope.puzzle)) {
        $interval.cancel(timer);
        $scope.solved = true;
      }
    }

    // TODO move to service
    function peek(k) {
      guess(k, $scope.puzzle.solution[k]);
      // TODO cell.peeked = true;
    }

    function undo() {
      var u = undos.pop();
      console.log('undo! %O', u);
      if (u) {
        if (u.action === 'guess') {
          $scope.puzzle.guesses[u.k] = u.guess;
          $scope.cursor = u.k;
        } else if (u.action === 'reset') {
          $scope.puzzle = u.puzzle;
          $scope.time = u.time;
          $scope.solved = xwd.isSolved($scope.puzzle);
          if (!$scope.solved) startTimer();
        }
      }
    }

    // TODO move model aspect to service
    function resetBoard() {
      undos.push({ action:'reset', time: $scope.time, puzzle: angular.copy($scope.puzzle) });
      //$scope.puzzle.guesses = $scope.puzzle.solution.replace(/[^:]/g, '-');
      $scope.puzzle.guesses = $scope.puzzle.solution.replace(/./g, '-');
      $scope.time = 0;
      $scope.solved = false;
      storeValues();
      startTimer();
      console.log('reset! undos %O', undos);
    }

    $scope.range = _.range;

    $scope.cursorAt = function(cell) {
      return !$scope.solved && !$scope.cursorHidden && $scope.cursor === cell;
    };

    function getGrid() { return $scope.isDiagramless ? puzzle.guesses : puzzle.solution }

    function setCursor(k) {
      if ($scope.isDiagramless || !xwd.isBlack(getGrid(), k)) {
        $scope.cursor = k;
        $scope.cursorHidden = false;
        currentClues[ACROSS] = xwd.getClue(getGrid(), puzzle.width, numbers, puzzle.clues, $scope.cursor, ACROSS);
        currentClues[DOWN] = xwd.getClue(getGrid(), puzzle.width, numbers, puzzle.clues, $scope.cursor, DOWN);
        focus = xwd.getWord(getGrid(), puzzle.width, $scope.cursor, direction);
        storeValues();
      }
    }

    $scope.setCursor = setCursor;

    // TODO move to service
    function isRight(cell) {
      return puzzle.guesses[cell] === puzzle.solution[cell];
    }

    // TODO move to service
    function isBlank(cell) {
      return puzzle.guesses[cell] === '-';
    }

    // true if a) checking is enabled, b) there's a guess in this cell, c) the guess is right
    $scope.checksRight = function(cell) {
      return $scope.checking && !isBlank(cell) && isRight(cell)
    };

    // true if a) checking is enabled, b) there's a guess in this cell, c) the guess is wrong
    $scope.checksWrong = function(cell) {
      return $scope.checking && !isBlank(cell) && !isRight(cell)
    };

    // TODO move to service
    $scope.answerAt = function(cell) {
      return $scope.puzzle.solution[cell];
    };

    // TODO move to service
    $scope.guessAt = function(cell) {
      var g = $scope.puzzle.guesses[cell];
      // TODO use regex
      return (g === '-' || g === ':' || g === '.') ? '' : g;
    };

    function row(cell) {
      return Math.floor(cell/puzzle.width);
    }

    function col(cell) {
      return cell % puzzle.width;
    }

    function pos(i, j) {
      return i * puzzle.width + j;
    }

    function advanceCursor(delta, dir) {
      if (!delta) delta = 1;
      if (!dir) dir = direction;
      var i = row($scope.cursor), j = col($scope.cursor);
      if (dir === ACROSS) {
        j = (j + delta).mod(puzzle.width);
      } else {
        i = (i + delta).mod(puzzle.height);
      }
      if (!$scope.isDiagramless && xwd.isBlack(getGrid(), pos(i,j))) {
        $scope.cursor = pos(i, j);
        advanceCursor(delta < 0 ? -1 : 1); // TODO prevent infinite loop here
      } else {
        setCursor(pos(i, j));
      }
    }

    $scope.isBlack = function(cell) {
      return xwd.isBlack(getGrid(), cell);
    };

    $scope.numberAt = function(cell) {
      return numbers[cell];
    };

    $scope.circleAt = function(cell) {
      return puzzle.extras.GEXT && puzzle.extras.GEXT[cell] & 0x80 === 0x80;
    };

    $scope.dirAbbr = function(dir) {
      if (dir === ACROSS) return 'A';
      if (dir === DOWN) return 'D';
      return '';
    };

    function renumber() {
      numbers = xwd.numberGrid(getGrid(), puzzle.width);
    }

    function isClue(n, dir) {
      return currentClues[dir] && currentClues[dir].number === n;
    }
    $scope.isClue = isClue;

    $scope.currentClue = function(dir) {
      return currentClues[dir || direction];
    };

    function isFocus(cell) {
      if (selection) return false;
      return focus[cell];
      //if (direction === ACROSS) return row(cell) === row($scope.cursor);
      //return col(cell) === col($scope.cursor);
    }
    $scope.isFocus = isFocus;

    function adjustSelection(direction, delta) {
      if (!selection) selection = { row1: row($scope.cursor), col1: col($scope.cursor) };
      advanceCursor(delta, direction);
      selection.row2 = row($scope.cursor);
      selection.col2 = col($scope.cursor);
    }

    function isSelected(cell) {
      return selection &&
        row(cell).isInRange(selection.row1, selection.row2) &&
        col(cell).isInRange(selection.col1, selection.col2);
    }
    $scope.isSelected = isSelected;


    function readBox(grid, width, rect) {
      var box = [];
      for (var i = 0; i < rect.rows; i++) {
        box[i] = [];
        for (var j = 0; j < rect.cols; j++) {
          var k = (rect.top + i) * width + (rect.left + j);
          box[i][j] = grid[k];
        }
      }
      return box;
    }

    function writeBox(grid, width, rect, box) {
      var base = rect.top * width + rect.left;
      for (var i = 0; i < box.length; i++) {
        for (var j = 0; j < box[i].length; j++) {
          var k = base + i * width + j;
          grid[k] = box[i][j];
        }
      }
    }

    function moveSelection(direction, delta) {
      var s = selection, top = Math.min(s.row1, s.row2), left = Math.min(s.col1, s.col2),
        rows = Math.abs(s.row2 - s.row1) + 1, cols = Math.abs(s.col2 - s.col1) + 1,
        grid = puzzle.guesses, width = puzzle.width,
        shift = direction === ACROSS ? { across: delta, down: 0 } : { across: 0, down: delta},
        back = delta < 0;

      // don't go off grid
      if (shift.across && (left + delta < 0 || left + cols + delta > width)) return;
      if (shift.down && (top + delta < 0 || top + rows + delta > puzzle.height))  return;

      var selRect = { top: top, left: left, rows: rows, cols: cols },
        selBox = readBox(grid, width, selRect),
        gapRect = {  // the space we're moving into
          top: top + (shift.across ? 0 : (back ? delta : rows)),
          left: left + (shift.down ? 0 : (back ? delta : cols)),
          rows: Math.abs(shift.down) || rows,
          cols: Math.abs(shift.across) || cols
        },
        gapBox = readBox(grid, width, gapRect);
      // move selection
      selRect.top += shift.down;
      selRect.left += shift.across;
      writeBox(grid, width, selRect, selBox);
      // move overwritten cells to the space we moved out of
      gapRect.top += shift.down ? (back ? rows : -rows) : 0;
      gapRect.left += shift.across ? (back ? cols : -cols) : 0;
      writeBox(grid, width, gapRect, gapBox);
      // update selection and cursor data
      selection.col1 += shift.across; selection.col2 += shift.across; $scope.cursor += shift.across;
      selection.row1 += shift.down; selection.row2 += shift.down; $scope.cursor += shift.down * width;
      puzzle.guesses = grid;
      renumber();
    }

    $scope.keydown = function($event) {
      // console.log('keydown: %d', $event.which);


      // TODO: only respond to these if grid is in focus
      // TODO: sensible preventDefault policy
      // TODO: check teleprompter for better keydown handling
      // TODO: should this all be key up???


      var cursor = $scope.cursor;
      var key = $event.which;

      if ($scope.rebusEntry) {
        if (key === 27 || key === 13) {
          $event.preventDefault();
          var val = document.getElementById('rebusInput').value; // TODO decouple this; too early to collect $scope.rebus
          if (key == 13) guess($scope.rebusEntry, val.toUpperCase()); // TODO scale to fit box
          $scope.rebus = '';
          document.getElementById('rebusInput').value = ''; // TODO do this right
          $scope.rebusEntry = null;
          $document[0].getElementById('board').focus();
          if (key === 13) advanceCursor();
        }
        return;
      }

      // arrow keys
      if (key >= 37 && key <= 40) {
        // prevent browser behavior
        $event.preventDefault();
        var dir = (key === 37 || key === 39) ? ACROSS : DOWN;
        var delta = (key === 37 || key === 38) ? -1 : 1;

        if ($event.shiftKey) {
          adjustSelection(dir, delta);

        } else if (selection) {
          moveSelection(dir, delta);
        } else {

          if (dir === direction) {
            // move cursor (back if left or down arrow, forward otherwise)
            advanceCursor(delta);
          } else {
            direction = dir;
            validateCursor();
          }
        }
      }


      //opt-r: reset board
      if (key === 82 && $event.altKey) resetBoard();

      else if ($scope.solved) return;

      // alphanumeric: set guess
      else if (key >= 48 && key <= 90) {
        guess(cursor, String.fromCharCode(key));
        advanceCursor();
      }

      // space: erase guess
      else if (key === 32) {
        guess(cursor, '-');
        advanceCursor();
        $event.preventDefault();
      }

      // delete: move back & erase guess
      else if (key === 8) {
        advanceCursor(-1);
        guess($scope.cursor, '-');
        $event.preventDefault();
      }

      // colon: make black
      else if (key === 186) {
        guess($scope.cursor, ':');
        advanceCursor();
      }

      // return: switch direction
      else if (key === 13) {
        if ($event.altKey) $scope.checking = !$scope.checking;
        else direction = direction === ACROSS ? DOWN : ACROSS;
      }


      // ?: peek
      else if (key === 191 && $event.shiftKey) peek(i, j);

      // esc: undo
      //else if (key === 27) {
      //  if (selection) selection = null; else undo();
      //}
      // esc: rebus
      else if (key === 27) {
        $scope.rebusEntry = $scope.cursor;
      }


    };

    $scope.keyup = function($event) {
      if ($scope.solved) return;
      var k = $event.which;
      if (k === 13) $scope.checking = false;
    };

    $document.ready(function() { $document[0].getElementById('board').focus(); });


    loadValues();

  });