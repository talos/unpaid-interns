/*
 * Copyright (C) 2012 John Krauss
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint browser: true*/
/*globals $, d3*/

(function () {
    "use strict";
    var QUESTIONS_LOCATION = "data/questions.tsv",
        VERSION = "1",
        FIRST_QUESTION = "1",
        BUTTON_COLUMNS = ['Yes', 'No', "Not sure"],
        MESSAGE_COLUMN = 'Message',
        BUTTON_CLASSES = 'btn btn-large',
        BUTTON_TEMPLATE = '<button class="' + BUTTON_CLASSES + '" />',
        RECORD_HOST = 'http://intern-labor-survey.herokuapp.com/',
        RECORD_ENDPOINT = '',
        $question = $('#question'),
        $choices = $('#choices'),
        $endgame = $('#endgame'),
        $reset = $('#reset a'),
        lastRow = 0,

        /**
         * Display the endgame scenario.
         */
        endgame = function () {
            $endgame.show();
        },

        /**
         * Input is a raw multi-line TSV as a string.  Output is a JSON
         * object with the first column used as the key for the hash.
         */
        parseTSV = function (tsv) {
            var parsed = {},
                rows = tsv.split('\n'),
                header = rows.shift().split('\t');
            $.each(rows, function (i, row) {
                var cols = row.split('\t'),
                    question = {};
                $.each(cols, function (i, col) {
                    question[header[i]] = col;
                });
                // assume first data column is ID
                parsed[cols[0]] = question;
            });
            return parsed;
        },

        /**
         * Convert questions to a tree.
         */
        asTree = function (questions) {
            var parsed = [], k, i, b, q;

            for (k in questions) {
                if (questions.hasOwnProperty(k)) {
                    q = questions[k];

                    for (i = 0; i < BUTTON_COLUMNS.length; i += 1) {
                        b = BUTTON_COLUMNS[i];
                        if (questions.hasOwnProperty(q[b])) {
                            q[b] = questions[q[b]];
                        } else {
                            delete q[b];
                        }
                    }

                    parsed.push(q);
                }
            }

            return parsed;
        },

        /**
         * Record the response to a question.
         */
        record = function (question, button) {
            $.ajax({
                url: RECORD_HOST + RECORD_ENDPOINT,
                data: {q: question, a: button, v: VERSION},
                crossDomain: true
            });
        },

        /**
         * Ask a question.
         */
        ask = function (id, questions) {
            var question = questions[id];
            $question.text(question[MESSAGE_COLUMN]);
            $choices.empty();
            $.each(BUTTON_COLUMNS, function (i, button) {
                var nextId = question[button];
                if (nextId !== '') {
                    $(BUTTON_TEMPLATE)
                        .text(button)
                        .on('click', function () {
                            record(question[MESSAGE_COLUMN], button);
                            ask(nextId);
                            // show the reset button after any click.
                            $reset.fadeIn();
                        }).appendTo($choices);
                }
            });
            if ($choices.is(':empty')) {
                endgame();
            }
        },

        /**
         * Start the questionnaire.
         */
        start = function (first_question, questions) {
            // hide the reset button at start
            $reset.fadeOut();
            $endgame.hide();
            ask(first_question, questions);
        },

        makeCell = function (d, $row, choice) {
            if (!d) {
                return;
            }
            if (!d.Message) {
                return;
            }
            var i, $el;

            d.$el = $('<div />')
                .addClass('response well glow ' +
                          (choice ? choice.toLowerCase().replace(' ', '-') : ''))
                .text(d.Message);
            $row.append(d.$el);
        },

        makeRow = function () {
            return $('<div />')
                .addClass('row')
                .appendTo('#flowchart');
        },

        visualize = function (first_question, questions) {
            var tree = asTree(questions), i, d, j, $row, choice;

            for (i = 0; i < tree.length; i += 1) {
                d = tree[i];

                if (!d.$el) {
                    $row = makeRow();
                    makeCell(tree[i], $row);
                }

                $row = makeRow();
                for (j = 0; j < BUTTON_COLUMNS.length; j += 1) {
                    choice = BUTTON_COLUMNS[j];
                    makeCell(d[choice], $row, choice);
                }
            }
            /*var svg = d3.select($('#flowchart')[0]).append('svg')
                .attr('xmlns', 'http://www.w3.org/2000/svg'),
                answers = svg.selectAll('.answers').data(questionsAsArray);

            answers.enter()
                .append('g')
                .classed('answer', true)
                .each(function (d, i) {
                    var question = d.Message,
                        width = 400,
                        height = 50,
                        y = i * height * 1.2,
                        el = d3.select(this);
                    el.attr('id', 'answer_' + d.ID);
                    if (question) {
                        el.append('svg:foreignObject').attr({
                            width: width,
                            height: height,
                            y: y
                        }).append('xhtml:body').attr({
                        }).append('div').text(d.Message);
                    }
                });

            answers.exit().remove();*/
        };

    // load questions
    $.get(QUESTIONS_LOCATION).done(function (resp) {
        // stateful
        var questions = parseTSV(resp);
        start(FIRST_QUESTION, questions);
        visualize(FIRST_QUESTION, questions);
        $reset.on('click', start);
    });
}());
