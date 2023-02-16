module Api
    module V1
      class Zones < Grape::API
        include Api::V1::Defaults
        format :json

        helpers do
          COLORS = ["#99d8f0", "#444c1d", "#44251d", "#796f5a", "#a03623", "#999999", "#738595", "#686c5e"]

          MATERIAL_DUMPING = {
            freq_2: [
              {color: "#99d8f0", dumping: 2 },          # гипсокартон
              {color: "#444c1d", dumping: 3 },          # одиночное стекло
              {color: "#44251d", dumping: 13 },         # двойное стекло
              {color: "#796f5a", dumping: 4 },          # дерево
              {color: "#a03623", dumping: 6 },          # кирпич
              {color: "#999999", dumping: [9, 17.5] },  # бетон
              {color: "#738595", dumping: 19 },         # металл
              {color: "#686c5e", dumping: 22.5 }        # железобетон
            ],
            freq_5: [
              {color: "#99d8f0", dumping: 4 },         # гипсокартон
              {color: "#444c1d", dumping: 8 },         # одиночное стекло
              {color: "#44251d", dumping: 20 },        # двойное стекло
              {color: "#796f5a", dumping: 7 },         # дерево
              {color: "#a03623", dumping: 10 },        # кирпич
              {color: "#999999", dumping: [13, 25] },  # бетон
              {color: "#738595", dumping: 32 },        # металл
              {color: "#686c5e", dumping: 30 }         # железобетон
            ],
          }

          #Учитывая три коллинеарных точки p, q, r, функция проверяет,
          # точка q лежит на отрезке прямой 'pr'
          def onSegment(p, q, r)
            if (q[:x] <= [p[:x], r[:x]].max && q[:x] >= [p[:x], r[:x]].min && q[:y] <= [p[:y], r[:y]].max && q[:y] >= [p[:y], r[:y]].min)
              return true
            end
            false
          end
  
          # Найти ориентацию упорядоченного триплета (p, q, r).
          # Функция возвращает следующие значения
          # 0 -> p, q и r являются коллинеарными
          # 1 -> по часовой стрелке
          # 2 -> против часовой стрелки
          def orientation(p, q, r)
            # см. Https://www.geeksforgeeks.org/orientation-3-ordered-points/amp/
            # для деталей нижеприведенной формулы.
            val = (q[:y] - p[:y]) * (r[:x] - q[:x]) - (q[:x] - p[:x]) * (r[:y] - q[:y]);

            return 0 if (val == 0)   # коллинеар
            (val > 0) ? 1 : 2 # часы или против часовой стрелки
          end

  
          # Основная функция, которая возвращает true, если отрезок линии 'p1q1'
          # и 'p2q2' пересекаются.
          def doIntersect(p1, q1, p2, q2)

            # Находим четыре ориентации, необходимые для общего и
            # Особые случаи
            o1 = orientation(p1, q1, p2)
            o2 = orientation(p1, q1, q2)
            o3 = orientation(p2, q2, p1)
            o4 = orientation(p2, q2, q1)

            # Общий случай
            return true if (o1 != o2 && o3 != o4) 

            # Особые случаи

            #p1, q1 и p2 коллинеарны, а p2 лежит на отрезке p1q1
            return true if (o1 == 0 && onSegment(p1, p2, q1)) 

            # p1, q1 и q2 коллинеарны, а q2 лежит на отрезке p1q1
            return true if (o2 == 0 && onSegment(p1, q2, q1)) 

            # p2, q2 и p1 коллинеарны, а p1 лежит на отрезке p2q2
            return true if (o3 == 0 && onSegment(p2, p1, q2)) 

            # p2, q2 и q1 коллинеарны, а q1 лежит на отрезке p2q2
            return true if (o4 == 0 && onSegment(p2, q1, q2)) 

            false # Не попадает ни в один из вышеперечисленных случаев
          end
        end
  
        resource :zones do
          desc "Return counted router zones"

          params do
            optional :pixels, type: Array, desc: 'Pixels'
            optional :routers, type: Array, desc: 'Routers'
            optional :walls, type: Array, desc: 'Walls'
            optional :measurements, type: Array, desc: 'Measurements'
            optional :receiver_coef, type: Integer, desc: 'Receiver coefficient'
            optional :wall_scale, type: Integer, desc: 'Wall scale'
          end
          
          post do
            pixels = params[:pixels]
            routers = params[:routers]
            walls = params[:walls]
            receiver_coef = params[:receiver_coef].to_f

            routers_coefs = routers.map do |router|
              coef = router[:coef].to_f * receiver_coef * ((3.0 / (router[:frequency].to_f * 10)) ** 2) / (16.0 * (Math::PI ** 2))
              {coef: coef, frequency: router[:frequency], x: router[:x], y: router[:y]}
            end

            size = pixels.size
            p routers_coefs

            new_pixels = pixels.each_with_index.map do |pixel, i|
              if (COLORS.include?(pixel) || pixel == "#99ff99")
                pixel
              else
                x = i % 350
                y = i / 350
                dumpings = routers_coefs.map do |router|
                  dumping = 0
                  y_cor = y
                  if size > 350 * 150
                    y_floor = y_cor / 160
                    router_floor = router[:x] / 160
                    y_cor += (router_floor - y_floor) * 160 
                    dumping += 25 * (y_floor - router_floor).abs
                  end
                  d = Math::sqrt(((x - router[:x]) ** 2) + ((y_cor - router[:y]) ** 2)) * params[:wall_scale] / 100.0
                  d = 0.01 if (d == 0)
                  dumping += 10*(Math::log10(router[:coef] / (d ** 2))).abs
                  walls.each do |wall|
                    next unless doIntersect({ x: x, y: y_cor }, { x: router[:x], y: router[:y] }, wall[:x].symbolize_keys, wall[:y].symbolize_keys)

                    if (router[:frequency] == '2.4')       
                      record_dumping = MATERIAL_DUMPING[:freq_2].select{|x| x[:color] == wall[:color]}.first[:dumping]
                    else
                      record_dumping = MATERIAL_DUMPING[:freq_5].select{|x| x[:color] == wall[:color]}.first[:dumping]
                    end
                    if (wall[:color] == "#999999")
                      dumping += wall[:thickness] < 10 ? record_dumping[0] : record_dumping[1]
                    else
                      dumping += record_dumping
                    end
                  end
                  dumping.round(0)
                end
                #print dumpings
                min_dumping = dumpings.min * 2
                green_code = (0xff - min_dumping).to_s(16)
                blue_code = (min_dumping).to_s(16)
                green_code = "0" + green_code if green_code.length == 1
                blue_code = "0" + blue_code if blue_code.length == 1
                (min_dumping < 256) ? "#00#{green_code}#{blue_code}" : "#0000ff"
              end
            end

            {pixels: new_pixels}
          end
        end
      end
    end
  end