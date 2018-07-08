angular.module('xwordApp', [])
  .service('XwordService', function($http) {

    // TODO: bug when entering black swuare diagramless
    // TODO: go back to i,j notation

    // TODO: new structure:
    //   puzzle {
    //      author, copyright, title, note,
    //      extras
    //      clues,
    //      solution {
    //        width, height,
    //        black, numbers, answers
    //      }
    //      guesses {
    //        width, height,
    //        black, numbers, answers
    //      }
    //  }

    // TODO update focus on key === 13


    var ACROSS = 'across',
      DOWN = 'down',
      puzzle = {};

    this.ACROSS = ACROSS;
    this.DOWN = DOWN;

    function puzzleFromFileData(data) {
      if (!data) return;
      // using file descriptions at
      // http://acrossdown.net/specification.htmvar puzzle = {}
      // https://code.google.com/archive/p/puz/wikis/FileFormat.wiki
      var
        decoder = new TextDecoder('ascii'),
        dv = new DataView(data),
        label = decoder.decode(data.slice(2, 13)),
        width = dv.getUint8(0x2C),
        height = dv.getUint8(0x2D),
        size = width * height,
        solution = decoder.decode(data.slice(0x34, 0x34 + size)).split(''),
        guesses = decoder.decode(data.slice(0x34 + size, 0x34 + size * 2)).split(''),
        clueCount = numClues(solution, width),
        info = decoder.decode(data.slice(0x34 + size * 2)).split('\0', clueCount + 4),
        title = info[0],
        author = info[1],
        copyright = info[2],
        numbersAndClues = numberGrid(solution, width, info.slice(3)),
        numbers = numbersAndClues.numbers,
        clues = numbersAndClues.clues,
        note = info[3 + clues.length],
        extras = {};

      // process extras as binary data
      var index = 0x34 + size * 2 + (info.join('').length + info.length); // length of strings plus their null terminators
      var code, len, content;
      while (index < data.byteLength) {
        code = decoder.decode(data.slice(index, index + 4)); // section title
        index += 4;
        len = dv.getInt16(index, true); // length is little-endian Int16 after title
        index += 4; // skip past past 2-byte length & 2-byte checksum
        content = data.slice(index, index + len);
        index += len + 1; // skip null terminator
        extras[code] = content;
      }

      // process rebus
      // The GRBS section is a "board" of one byte per square
      // Each byte indicates whether or not the square contains a rebus. Possible values are:
      //    0: no rebus
      //    1+n: a rebus, the solution for which is given by the entry with key n in the RTBL section
      // The RTBL section  is a string containing the solutions for any rebus squares.
      // These solutions are given as an ascii string. For each rebus there is a number, a colon, a string and a semicolon.
      // The number (an ascii string) is always two characters long - if it is only one digit, the first character is a space.
      // It is key that the GRBS section uses to refer to this entry (it is one less than the number that appears in the GRBS).
      // The string is the rebus solution.
      // For example, in a puzzle which had four rebus squares "HEART", "DIAMOND", "CLUB", and "SPADE", the string might be:
      //    " 0:HEART; 1:DIAMOND;17:CLUB;23:SPADE;"
      if (extras.GRBS) extras.GRBS = new Uint8Array(extras.GEXT);
      if (extras.GRBS && extras.RTBL) {
        var table = [];
        decoder.decode(extras.RTBL).trim().replace(/;$/, '').split(/; */).forEach(function(item) {
          var kv = item.split(':');
          table[parseInt(kv[0])] = kv[1];
        });
        extras.RTBL = table;
        for (var k = 0; k < size; k++) {
          if (extras.GRBS[k]) {
            solution[k] = table[extras.GRBS[k] - 1];
          }
        }
      }

      // The GEXT section is a "board" of one byte per square.
      // Each byte is a bitmask indicating that some style attributes are set.
      // The meanings of four bits are known:
      //    0x10 means that the square was previously marked incorrect
      //    0x20 means that the square is currently marked incorrect
      //    0x40 means that the contents were given
      //    0x80 means that the square is circled.
      // None, some, or all of these bits may be set for each square. It is possible that they have reserved other values.
      if (extras.GEXT) extras.GEXT = new Uint8Array(extras.GEXT);

      // TODO support LTIM
      // The LTIM section stores two pieces of information: time elapsed and whether the timer is running.
      // An ascii string, two integers separated by a comma
      // <seconds elapsed>,<timer running ? 1 : 0>
      // "42,1" means 42 seconds have elapsed, and timer is running

      console.log('solution', solution);
      puzzle = {
          width: width, height: height,
          solution: solution, guesses: guesses, clues: clues, numbers: numbers,
          author: author, title: title, copyright: copyright, note: note, extras: extras
        };

      // TODO: do this right. It's just to remove : from guesses in diagramless
      // The situation seems to be: in solution, ':' means a black square, and puzzle is meant to be diagramless
      // in guesses, ':' means user has not filled this square, but square is black in solution
      // '.' I guess would mean user has marked the square black
      puzzle.guesses = (_.repeat('-', puzzle.guesses.length)).split('');
      return puzzle;
    }
    this.puzzleFromFileData = puzzleFromFileData;

    function numberGrid(grid, width, clueList) {
      var number = 1;
      var numbers = [];
      var clues = clueList ? [] : null;

      for (var k = 0; k < grid.length; k++) {
        [ACROSS, DOWN].forEach(function(dir) {
          if (isStartCell(grid, width, k, dir)) {
            if (clues) clues.push({number: number, direction: dir, clue: clueList[clues.length]});
            numbers[k] = number;
          }
        });
        if (numbers[k]) number++;
      }
      return clues ? { numbers: numbers, clues: clues } : numbers;
    }
    this.numberGrid = numberGrid;

    function numClues(grid, width) {
      var count = 0;
      for (var k = 0; k < grid.length; k++) {
        [ACROSS, DOWN].forEach(function(dir) {
          if (isStartCell(grid, width, k, dir)) count++;
        });
      }
      return count;
    }

    function isStartCell(grid, width, k, direction) {
      var one = direction === ACROSS ? 1 : width,
        place = direction === ACROSS ? k % width : Math.floor(k/width),
        startsLine = place === 0,
        endsLine = direction === ACROSS ? place === width - 1 : k + width >= grid.length;
      return !isBlack(grid, k) && (startsLine || isBlack(grid, k - one)) && !(endsLine || isBlack(grid, k + one));
    }

    function isBlack(grid, k) {
      return grid[k] === ':' || grid[k] === '.';
    }
    this.isBlack = isBlack;

    function whichClue(grid, width, numbers, k, direction) {
      if (isBlack(grid, k)) return null;
      if (isStartCell(grid, width, k, direction)) return numbers[k];
      var backOne = k - (direction === ACROSS ? 1 : width);
      return whichClue(grid, width, numbers, backOne, direction);
    }

    function getClue(grid, width, numbers, clues, k, direction) {
      var n = whichClue(grid, width, numbers, k, direction);
      return _.find(clues, { number: n, direction: direction });
    }
    this.getClue = getClue;

    function getWord(grid, width, k, direction) {

      if (isBlack(grid, k)) return null;

      var one = direction === ACROSS ? [0, 1] : [1, 0];
      var height = grid.length / width;
      var start = [Math.floor(k/width), k % width];

      function off(i, j) { return 0 > i || i >= height || 0 > j || j >= width; }
      function black(i, j) { return isBlack(grid, i * width + j) }

      var i, j, word = [];
      for (i = start[0], j = start[1];
           !black(i, j) && !off(i, j);
           i -= one[0], j -= one[1]) {
        word[i * width + j] = true;
      }
      for (i = start[0], j = start[1];
           !black(i, j) && !off(i, j);
           i += one[0], j += one[1]) {
        word[i * width + j] = true;
      }
      return word;
    }
    this.getWord = getWord;

    this.isSolved = function(puzzle, checkBlacks) {
      for (var k = 0; k < puzzle.solution.length; k++) {
        if (isBlack(puzzle.solution, k)) {
          if (checkBlacks && !isBlack(puzzle.guesses, k)) return false;
        } else {
          if (puzzle.guesses[k] !== puzzle.solution[k]) return false;
        }
      }
      return true;
    };

});
