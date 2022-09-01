import { isFunction } from './utils';

let count = 0;
const prefix = 'HYG_',
    getLines = ({ entries, elementsPerLine }) => Math.ceil(entries.length / elementsPerLine),
    inRange = ({ n, from, to }) => n >= from && n <= to;

// eslint-disable-next-line one-var
export const trakTime = ({ what, time, opts }) =>
    console.info(`%c${opts.lib.toUpperCase()} 🐢 ${what} spent ${time}ms`, 'color:DodgerBlue'),
    doWarn = ({ message, opts }) =>
        console.warn(`${opts.lib.toUpperCase()} 🙉 ${message}`),
    doThrow = ({ message, opts }) => {
        throw `${opts.lib.toUpperCase()} 🚨 ${message}`;
    },
    __getFilterFactory = ({ columns, filters, opts = {} }) => {

        const trak = opts.trakTimes ? { start: +new Date() } : null,
            { funcFilteredFields, valueFilteredFields } = columns.reduce((acc, f) => {
                acc[(f in filters) ? 'funcFilteredFields' : 'valueFilteredFields'].push(f);
                return acc;
            }, { funcFilteredFields: [], valueFilteredFields: [] }),
            ret = global => row =>
                funcFilteredFields[global ? 'some' : 'every'](fk =>
                    filters[fk].filter({
                        userValue: global || filters[fk].value,
                        row
                    })
                )
                ||
                valueFilteredFields.some(f => `${row[f]}`.includes(global));

        if (opts.trakTimes) {
            trak.end = +new Date();
            trakTime({ what: '__getFilterFactory', time: trak.end - trak.start, opts });
        }
        return ret;
    },


    __applyFilter = ({ globalValue, groupedData, gFilter, filter, elementsPerLine, opts = {} }) => {
        /**
         * {
         *      [groupName]: {
         *          entries: [{...}],
         *          lines: #of lines for that group
         *      }
         * }
         */
        const trak = opts.trakTimes ? { start: +new Date() } : null,
            groupNames = Object.keys(groupedData),
            initialGroupedDataGobalFiltered = globalValue
                ? groupNames.reduce((acc, groupName) => {
                    const entries = groupedData[groupName].entries.filter(gFilter);
                    acc[groupName] = {
                        entries,
                        lines: getLines({ entries, elementsPerLine })
                    };
                    return acc;
                }, {})
                : groupedData,
            ret = groupNames.reduce((acc, groupName) => {
                const entries = initialGroupedDataGobalFiltered[groupName].entries.filter(filter);
                acc[groupName] = {
                    entries,
                    lines: getLines({ entries, elementsPerLine })
                };
                return acc;
            }, {});
        if (opts.trakTimes) {
            trak.end = +new Date();
            trakTime({ what: '__applyFilter', time: trak.end - trak.start, opts });
        }
        return ret;
    },


    __cleanFilters = _filters => Object.keys(_filters).reduce((acc, k) => {
        acc[k] = {
            filter: _filters[k].filter,
            value: ''
        };
        return acc;
    }, {}),


    __composeFilters = ({ headers, opts = {} }) => {
        const trak = opts.trakTimes ? { start: +new Date() } : null,
            ret = headers.reduce((acc, header) => {

                // in case a header has a filter, use it
                if (isFunction(header.filter)) {
                    acc[header.key] = {
                        filter: header.filter,
                        value: header.preFiltered || ''
                    };
                    // otherwise let data pass
                } else {
                    acc[header.key] = {
                        filter: () => true,
                        value: ''
                    };
                }

                return acc;
            }, {});
        if (opts.trakTimes) {
            trak.end = +new Date();
            trakTime({ what: '__composeFilters', time: trak.end - trak.start, opts });
        }
        return ret;
    },

    /**
     * NOT PERFORMING BETTER
     */
    __getGrouped0 = ({ data, groups, elementsPerLine, opts = {} }) => {
        const trak = opts.trakTimes ? { start: +new Date() } : null,

            tmpGroupFlags = Array.from({ length: data.length }, () => true),

            g = groups.reduce((acc, { label, grouper }) => {
                const entries = data.filter((row, i) => {
                    if (!tmpGroupFlags[i]) return false;
                    if (grouper && grouper(row)) {
                        tmpGroupFlags[i] = false;
                        return true;
                    }
                    return false;
                });

                // skip empties and warn
                if (entries.length) {
                    acc[label] = {
                        entries,
                        lines: getLines({ entries, elementsPerLine })
                    };
                } else {
                    doWarn({ message: `group named \`${label}\` is empty thus ignored`, opts });
                }
                return acc;
            }, {}),
            // might be` some data does not belong to any group
            outcasts = data.filter((row, i) => tmpGroupFlags[i]);

        // out outcasts in the right place and warn
        if (outcasts.length) {
            g[opts.ungroupedLabel] = {
                entries: outcasts,
                lines: getLines({ entries: outcasts, elementsPerLine })
            };
            doWarn({ message: `${outcasts.length} elements are ungrouped`, opts });
        }
        if (opts.trakTimes) {
            trak.end = +new Date();
            trakTime({ what: '__getGrouped', time: trak.end - trak.start, opts });
        }
        return g;
    },


    /**
     * If we loop over filters and for each filter we loop over all data (even skipping the entries
     * already included somewhere, check __getGrouped0) it is a way slower compared to 
     * looping on each entry and find the first filter get it (if any)
     */
    __getGrouped = ({ data, groups, elementsPerLine, opts = {} }) => {
        console.log({groups})
        const trak = opts.trakTimes ? { start: +new Date() } : null,
            g = data.reduce((acc, d) => {
                const filter = groups.find(({ grouper }) => grouper(d));
                if (filter) {
                    if (!(filter.label in acc)) acc[filter.label] = [];
                    acc[filter.label].push(d);
                } else {
                    acc[opts.ungroupedLabel].push(d);
                }
                return acc;
            }, {
                // be sure to mantain the original order
                ...groups.reduce((acc, g) => {
                    acc[g.label] = [];
                    return acc;
                }, {}),
                [opts.ungroupedLabel]: []
            });
        if (groups.length && g[opts.ungroupedLabel].length) {
            doWarn({ message: `${g[opts.ungroupedLabel].length} elements are ungrouped`, opts });
        }
        if (opts.trakTimes) {
            trak.end = +new Date();
            trakTime({ what: '__getGrouped2', time: trak.end - trak.start, opts });
        }
        // return group entries & lines filtering out empty groups
        return Object.entries(g).reduce((acc, [name, groupEntries]) => {
            if (groupEntries.length) {
                acc[name] = {
                    entries: groupEntries,
                    lines: getLines({ entries: groupEntries, elementsPerLine }),
                    
                };
            } else {
                name !== opts.ungroupedLabel
                && doWarn({ message: `group named \`${name}\` is empty thus ignored`, opts });
            }
            return acc;
        }, {});
    },


    __getVirtual = ({ dimensions, size, lineGap, grouping, grouped, scrollTop = 0 }) => {

        const { height, itemHeight, width, itemWidth } = dimensions,
            columns = Math.floor(width / itemWidth),
            lines = Math.ceil(size / columns),
            carpetHeight = lines * itemHeight,
            //take into accounts groups-1 * groupComponentHeight
            // + (grouping.groups.length - 1) * grouping.group.height,
            trigger = scrollTop > (lineGap + 1) * itemHeight,

            topLinesSkipped = Math.max(0, Math.floor(scrollTop / itemHeight) - lineGap),

            topFillerHeight = topLinesSkipped * itemHeight,
            linesToRender = 2 * lineGap + Math.ceil(height / itemHeight),
            dataHeight = linesToRender * itemHeight,
            maxRenderedItems = columns * linesToRender,
            bottomFillerHeight = Math.max(carpetHeight - topFillerHeight - dataHeight, 0),
            fromItem = trigger
                ? topLinesSkipped * columns
                : 0,
            toItem = trigger ? fromItem + maxRenderedItems : linesToRender * columns;
        return {
            fromItem,
            toItem,
            carpetHeight,
            topFillerHeight,
            bottomFillerHeight,
            linesToRender,
            dataHeight,
            maxRenderedItems,
            loading: false,
            lines,
            columns,
            scrollTop,
        };
    },

    __getVirtualGroup = ({ dimensions, lineGap, grouping, grouped, scrollTop, elementsPerLine, opts = {} }) => {
        console.log('grouped: ', grouped);
        console.log('grouping: ', grouping);
        console.log('check groups name order: ', Object.keys(grouped));
        console.log(dimensions);


        const trak = opts.trakTimes ? { start: +new Date() } : null,
            { contentHeight, itemHeight, height } = dimensions,
            { groupHeader, groups } = grouping,
            { ungroupedLabel } = grouping,
            
            // groupHeader = grouping.group,
            groupKeys = Object.keys(grouped),

            /**
             * flag to spot the case no named groups are set
             * in that case there will be only the the `ungroupedLabel` labelled group
             * and the header should be ignored
             */
            onlyUngrouped = groupKeys.length === 1 && groupKeys[0] === ungroupedLabel,

            headerHeight = onlyUngrouped ? 0 : groupHeader.height,
            /**
             * cumpute each group dimension including the header and sum up to get the carpetHeight
             */
            groupingDimensions = Object.entries(grouped).reduce((acc, [groupName, group]) => {
                /**
                 * if there is no data then we should skip it, but
                 * __getGrouped ,which returns what here we get as 'groouped',
                 * automatically skips groups that do not contain any data
                 * thus we can skip it (see the 'impossible' group in configSmall)
                 * 
                 * if (!groupData.entries.length) return acc;
                 */

                const groupHeight = group.lines * itemHeight + headerHeight;

                acc.carpetHeight += groupHeight;
                acc.groupsHeights[groupName] = groupHeight;
                return acc;
            }, { carpetHeight: 0, groupsHeights: {} }),
            { carpetHeight } = groupingDimensions,

            // group here brings the right order given in the config
            // here on first instance we scan through aiming to find the starting&ending element to 
            // include (considering headers and lines)
            range = { from: scrollTop, to: scrollTop + contentHeight },
            headerHeight2 =  headerHeight/2,
            itemHeight2 = itemHeight/2,
            topGap = lineGap,
            bottomGap = lineGap,

            

            allocation = Object.entries(grouped).reduce((acc, [label, group], groupKey) => {
                // console.log(' G ', label, {groupKey,contentHeight, topGap, bottomGap});
                // console.log(' G ', label, {contentHeight})
                /** 
                 * Here we can be sure that all the groups will have a
                 * positive height at least equal to one line (itemHeight)
                 * ---------------------------------
                 * linegap + 1 set in the reducer: why ? 
                 * 
                 * linegap by default is the constant LINE_GAP (currently 2)
                 * as edge case let's suppose it's set to 0; the inRange function checks
                 * if n is in the viewport (range) and n is passed as the mean vertical point
                 * allowing to make only 2 comparisons but,  if only the lower 40% or the item (line)
                 * appears at the top of the viewport it will not result within the range 
                 * and this would be a problem, to solve it we can
                 * - use a 4 comparison rangeInRange function instead of inRange to check if
                 *   the top of the line is in the range OR the bottom is in the range (4 comparison)
                 * - use the less expensive inRange and use lineGap+1 so that when we take lineGap
                 *   into account we basically render one more element at the top and at the bottom
                 * the second option might do the whole 'inRange' check on average in half the time
                 * thus is the choosen option
                 */

                let { cursor, firstRender, firstNotRender } = acc;
                const headerRenders = onlyUngrouped ? false : inRange({n: cursor + headerHeight2, ...range}),
                    groupHeight = groupingDimensions.groupsHeights[label];
                
                acc.alloc[label] = {
                    header: {
                        from: cursor,
                        to: cursor + headerHeight,
                        renders: headerRenders,
                    },
                    lines: Array.from({length: group.lines}, (_, i) => {
                        const from = cursor + headerHeight + i * itemHeight,
                            renders = inRange({n: from + itemHeight2, ...range});

                        if (!firstRender && (renders || headerRenders)) {
                            firstRender = {
                                group: label,
                                type: headerRenders ? 'header' : i
                            };
                            /**
                             * now we could get
                             * //   acc.dataFrom = from - (headerRenders ? headerHeight : 0);
                             * but this would ignore the lineGap
                             */
                            
                        }

                        /**
                         * if the firrst render has been tracked
                         * then check for the first non render
                         **/
                        if (firstRender && !firstNotRender && (!renders || !headerRenders)){
                            firstNotRender = {
                                group: label,
                                type: headerRenders ? i : 'header'
                            };
                            /** 
                             * same here we could
                             * //   acc.dataTo = from - (headerRenders ? headerHeight : 0); 
                             * and then get 
                             * //   allocation.topFillerHeight = allocation.dataFrom;
                             * //   allocation.bottomFillerHeight = carpetHeight - allocation.dataTo;
                             * but this would ignore the lineGap
                             * 
                             * once we consider the lineGap, and get dataFrom and dataTowe can still use the same logic
                             */
                            
                        }
                        return {
                            renders,
                            from,
                            to: from + itemHeight
                        };
                    })
                };
                
                acc.firstRender = firstRender;
                acc.firstNotRender = firstNotRender;
                acc.cursor += groupHeight;
                return acc;
            }, {
                alloc: {}, 
                cursor: 0,
                firstRender: null,
                firstNotRender: null,
                //dataFrom: null, // the starting pixel in the carpet for the rendering area
                                // dataHeight here
                //dataTo: null,   // the ending pixel in the carpet for the rendering area
                                // will be used to calculate topFillerHeight and bottomFillerHeight
            });

        /**
         * now we need still to do a small thing on allocation cause we need to
         * - use lineGap and firstRender and firstNotRender
         *   to turn true the rendering of the right elements
         * - calculate topFillerHeight and bottomFillerHeight
         * 
         * notice that after doing the right thing with lineGap, we can cleanup allocation
         * removing all elements that do not render 
         **/











        
        if (opts.trakTimes) {
            trak.end = +new Date();
            trakTime({ what: '__getVirtualGroup', time: trak.end - trak.start, opts });
        }
        
        return {
            groupingDimensions,
            allocation: {
                ...allocation,
                // alloc: gappedAllocation
            }
        };
    },


    uniqueID = {
        toString: () => {
            count += 1;
            return prefix + count;
        }
    };